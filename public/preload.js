const { contextBridge, ipcRenderer } = require('electron');

// Utility functions for input validation
const validateInput = {
  username: (username) => {
    // Allow empty username for default user
    if (!username) return '';
    
    if (typeof username !== 'string' || username.length < 3 || username.length > 32) {
      throw new Error('Username must be between 3 and 32 characters');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
    }
    return username;
  },
  
  peerAddress: (address) => {
    if (typeof address !== 'string' || address.length === 0) {
      throw new Error('Invalid peer address');
    }
    if (address.length > 100) {
      throw new Error('Peer address too long');
    }
    return address;
  },
  
  sql: (sql) => {
    if (typeof sql !== 'string' || sql.length === 0) {
      throw new Error('Invalid SQL query');
    }
    
    // Sanitize the query - only allow basic SQL operations
    const normalizedSQL = sql.trim().toLowerCase();
    const allowedOperations = ['select', 'insert', 'update', 'delete', 'create', 'drop'];
    if (!allowedOperations.some(op => normalizedSQL.startsWith(op))) {
      throw new Error('Invalid SQL operation');
    }
    
    // Basic SQL injection prevention
    const dangerousPatterns = [
      /;\s*\w+/,          // Multiple statements
      /--(?!\s*$)/,       // Comments (allow trailing --)
      /\/\*/,             // Multi-line comments
      /xp_/i,             // XP cmdshell
      /union\s+select/i,  // UNION attacks
      /into\s+(?:dump|out)file/i, // File operations
    ];
    
    if (dangerousPatterns.some(pattern => pattern.test(sql))) {
      throw new Error('Potential SQL injection detected');
    }
    
    return sql;
  },
  
  sqlParams: (params) => {
    if (!params || typeof params !== 'object') {
      throw new Error('Invalid SQL parameters');
    }
    // Validate each parameter
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value !== 'string' && typeof value !== 'number' && value !== null) {
        throw new Error(`Invalid parameter type for ${key}`);
      }
      if (typeof value === 'string' && value.length > 1000) {
        throw new Error(`Parameter ${key} exceeds maximum length`);
      }
    });
    return params;
  },

  dimensions: (width, height) => {
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      throw new Error('Window dimensions must be integers');
    }
    if (width < 300 || width > 1920 || height < 300 || height > 1080) {
      throw new Error('Window dimensions out of valid range');
    }
    return { width, height };
  }
};

// Expose protected methods with enhanced validation
contextBridge.exposeInMainWorld(
  'electronAPI', {
    // Window management
    resizeWindow: (width, height) => {
      const validDimensions = validateInput.dimensions(width, height);
      ipcRenderer.send('resize-window', validDimensions.width, validDimensions.height);
    },

    // Get port number
    getPort: async () => {
      return await ipcRenderer.invoke('get-port');
    },

    // Database operations
    database: {
      init: async (username) => {
        const validUsername = validateInput.username(username);
        return await ipcRenderer.invoke('init-database', validUsername);
      },
      query: async (sql, params = {}) => {
        const validSQL = validateInput.sql(sql);
        const validParams = validateInput.sqlParams(params);
        return await ipcRenderer.invoke('database-query', validSQL, validParams);
      },
      createConversation: async (peerAddress) => {
        const validAddress = validateInput.peerAddress(peerAddress);
        return await ipcRenderer.invoke('create-conversation', validAddress);
      },
      insertMessage: async (peerId, content, sent) => {
        const validPeer = validateInput.peerAddress(peerId);
        if (typeof content !== 'string' || content.length === 0) {
          throw new Error('Invalid message content');
        }
        if (typeof sent !== 'boolean') {
          throw new Error('sent must be a boolean');
        }
        return await ipcRenderer.invoke('insert-message', validPeer, content, sent);
      },
      deleteConversation: async (peerAddress) => {
        const validAddress = validateInput.peerAddress(peerAddress);
        return await ipcRenderer.invoke('delete-conversation', validAddress);
      },
      cleanup: async () => {
        return await ipcRenderer.invoke('cleanup-database');
      },
      inspect: async () => {
        return await ipcRenderer.invoke('inspect-database');
      }
    },

    // App lifecycle
    onAppReady: (callback) => {
      if (typeof callback !== 'function') {
        throw new Error('Callback must be a function');
      }
      ipcRenderer.on('app-ready', callback);
    },

    network: {
      getPublicIP: async () => {
        return await ipcRenderer.invoke('get-public-ip');
      }
    }
  }
); 