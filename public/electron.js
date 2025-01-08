const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const WebSocket = require('ws');
const Database = require('better-sqlite3');
const fs = require('fs');
const crypto = require('crypto');

let mainWindow;
let wsClient;
let db;

// Security utility functions
const security = {
  sanitizeUsername: (username) => {
    // Handle default user case
    if (!username) return 'default';
    
    // Additional server-side validation
    if (typeof username !== 'string' || 
        username.length < 3 || 
        username.length > 32 || 
        !/^[a-zA-Z0-9_-]+$/.test(username)) {
      throw new Error('Invalid username format');
    }
    return username;
  },

  validateDBPath: (dbPath) => {
    const normalizedPath = path.normalize(dbPath);
    // Allow paths within our data directory
    if (!normalizedPath.startsWith(DATA_PATH)) {
      throw new Error('Invalid database path');
    }
    return normalizedPath;
  },

  validateSQL: (sql, params) => {
    if (typeof sql !== 'string' || sql.length === 0) {
      throw new Error('Invalid SQL query');
    }

    // Ensure query is read-only for SELECT queries
    const normalizedSQL = sql.trim().toLowerCase();
    if (normalizedSQL.startsWith('select')) {
      // Check for SQL injection patterns
      const sqlInjectionPatterns = [
        /;\s*$/,           // Query ending with semicolon
        /--/,              // SQL comments
        /\/\*/,            // Multi-line comments
        /UNION/i,          // UNION attacks
        /INTO\s+OUTFILE/i, // File operations
        /LOAD_FILE/i,      // File reading
      ];

      if (sqlInjectionPatterns.some(pattern => pattern.test(sql))) {
        throw new Error('Potential SQL injection detected');
      }
    }

    // Validate parameters
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([key, value]) => {
        if (typeof value !== 'string' && typeof value !== 'number' && value !== null) {
          throw new Error(`Invalid parameter type for ${key}`);
        }
        if (typeof value === 'string' && value.length > 1000) {
          throw new Error(`Parameter ${key} exceeds maximum length`);
        }
      });
    }

    return { sql, params };
  }
};

// Ensure data directory exists in the project root
const DATA_PATH = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_PATH)) {
  fs.mkdirSync(DATA_PATH, { recursive: true });
}

// Initialize database for a user
function initUserDatabase(username) {
  try {
    console.log('Initializing database for user:', username);
    const sanitizedUsername = security.sanitizeUsername(username);
    const dbPath = security.validateDBPath(
      path.join(DATA_PATH, `${sanitizedUsername}.db`)
    );
    console.log('Database path:', dbPath);
    
    closeDatabase(); // Close any existing connection
    
    db = new Database(dbPath, { 
      readonly: false,
      fileMustExist: false,
      timeout: 5000,
      verbose: console.log
    });
    
    // Enable WAL mode for better concurrency and reliability
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    
    // Create tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        peer TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        sent BOOLEAN NOT NULL,
        encrypted BOOLEAN NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS peers (
        address TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        last_seen INTEGER,
        CONSTRAINT valid_address CHECK (length(address) <= 100),
        CONSTRAINT valid_name CHECK (length(name) <= 50)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_peer ON messages(peer);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    `);

    return true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    return false;
  }
}

// Clean up database connection
function closeDatabase() {
  if (db) {
    try {
      db.close();
      db = null;
    } catch (error) {
      console.error('Error closing database:', error);
    }
  }
}

// Test SQLite functionality
function testSQLite() {
  try {
    const testDb = new Database(':memory:');
    testDb.prepare('SELECT 1 + 1 as result').get();
    console.log('SQLite is working correctly!');
    testDb.close();
    return true;
  } catch (error) {
    console.error('SQLite test failed:', error);
    return false;
  }
}

// Handle database initialization request
ipcMain.handle('init-database', async (event, username) => {
  closeDatabase(); // Close any existing connection
  return initUserDatabase(username);
});

// Handle database queries securely
ipcMain.handle('database-query', async (event, sql, params) => {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    const { sql: validSQL, params: validParams } = security.validateSQL(sql, params);
    
    const stmt = db.prepare(validSQL);
    return stmt.all(validParams);
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
});

function connectToDevServer() {
  wsClient = new WebSocket('ws://127.0.0.1:3000/ws');
  
  wsClient.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      if (message.type === 'hash' || message.type === 'still-ok') {
        createWindow();
      }
    } catch (err) {
      console.log('WebSocket message:', data.toString());
    }
  });

  wsClient.on('error', () => {
    setTimeout(connectToDevServer, 1000);
  });
}

function createWindow() {
  if (mainWindow) return;

  if (!testSQLite()) {
    console.error('SQLite test failed - application may not work correctly');
  }

  mainWindow = new BrowserWindow({
    width: 400,
    height: 500,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    backgroundColor: '#36393f',
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#2f3136',
      symbolColor: '#dcddde'
    }
  });

  ipcMain.on('resize-window', (event, width, height) => {
    if (event.sender !== mainWindow.webContents) {
      console.error('Unauthorized resize request');
      return;
    }
    
    if (width < 300 || height < 300) {
      console.error('Invalid window dimensions');
      return;
    }

    mainWindow.setSize(width, height);
    mainWindow.center();
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();

    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.key.toLowerCase() === 'i') {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      }
    });
  }

  mainWindow.loadURL('http://127.0.0.1:3000')
    .then(() => {
      mainWindow.show();
      mainWindow.webContents.send('app-ready');
    })
    .catch(() => app.quit());

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (wsClient) wsClient.close();
    closeDatabase();
    app.quit();
  });
}

app.whenReady().then(connectToDevServer);

app.on('window-all-closed', () => {
  if (wsClient) wsClient.close();
  closeDatabase();
  app.quit();
});

// Message handling functions
async function insertMessage(peerId, content, sent) {
  if (!db) throw new Error('Database not initialized');
  
  const messageId = crypto.randomUUID();
  const timestamp = Date.now();
  
  try {
    // First ensure peer exists
    const peerStmt = db.prepare(`
      INSERT OR IGNORE INTO peers (address, name, last_seen)
      VALUES (?, ?, ?)
    `);
    peerStmt.run(peerId, `User-${peerId.slice(0, 8)}`, timestamp);
    
    // Then insert the message
    const msgStmt = db.prepare(`
      INSERT INTO messages (id, peer, content, timestamp, sent, encrypted)
      VALUES (?, ?, ?, ?, ?, 0)
    `);
    msgStmt.run(messageId, peerId, content, timestamp, sent ? 1 : 0);
    
    // Update peer's last_seen time
    const updatePeerStmt = db.prepare(`
      UPDATE peers SET last_seen = ? WHERE address = ?
    `);
    updatePeerStmt.run(timestamp, peerId);
    
    return {
      id: messageId,
      peer: peerId,
      content,
      timestamp,
      sent,
      encrypted: false
    };
  } catch (error) {
    console.error('Failed to insert message:', error);
    throw error;
  }
}

// Create a new conversation with a peer
async function createConversation(peerAddress) {
  if (!db) throw new Error('Database not initialized');

  try {
    const timestamp = Date.now();
    
    // Add the peer
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO peers (address, name, last_seen)
      VALUES (?, ?, ?)
    `);
    
    stmt.run(peerAddress, `User-${peerAddress.slice(0, 8)}`, timestamp);
    return true;
  } catch (error) {
    console.error('Failed to create conversation:', error);
    return false;
  }
}

// Remove old addTestConversation function and replace with these handlers
ipcMain.handle('create-conversation', async (event, peerAddress) => {
  return createConversation(peerAddress);
});

ipcMain.handle('insert-message', async (event, peerId, content, sent) => {
  return insertMessage(peerId, content, sent);
});

// Simple database inspection function
async function inspectDatabase() {
  if (!db) {
    console.log('No database connection!');
    return;
  }

  try {
    // Check peers
    const peers = db.prepare('SELECT * FROM peers').all();
    console.log('\n=== PEERS IN DATABASE ===');
    console.log(peers);

    // Check messages
    const messages = db.prepare('SELECT * FROM messages').all();
    console.log('\n=== MESSAGES IN DATABASE ===');
    console.log(messages);

    // Some basic stats
    console.log('\n=== DATABASE STATS ===');
    console.log(`Total peers: ${peers.length}`);
    console.log(`Total messages: ${messages.length}`);
    
    // Show messages grouped by peer
    peers.forEach(peer => {
      const peerMessages = messages.filter(m => m.peer === peer.address);
      console.log(`\nMessages for ${peer.address}: ${peerMessages.length}`);
      peerMessages.forEach(m => {
        console.log(`  ${m.sent ? '→' : '←'} ${m.content} (${new Date(m.timestamp).toLocaleTimeString()})`);
      });
    });
  } catch (error) {
    console.error('Error inspecting database:', error);
  }
}

// Add handler to expose this to the renderer
ipcMain.handle('inspect-database', async () => {
  return inspectDatabase();
});

// Delete a conversation and all its messages
async function deleteConversation(peerAddress) {
  if (!db) throw new Error('Database not initialized');

  try {
    // Delete all messages first
    const deleteMessages = db.prepare('DELETE FROM messages WHERE peer = ?');
    deleteMessages.run(peerAddress);

    // Then delete the peer
    const deletePeer = db.prepare('DELETE FROM peers WHERE address = ?');
    deletePeer.run(peerAddress);

    return true;
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    return false;
  }
}

// Add handler for conversation deletion
ipcMain.handle('delete-conversation', async (event, peerAddress) => {
  return deleteConversation(peerAddress);
}); 