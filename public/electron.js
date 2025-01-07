const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load the React app
  mainWindow.loadURL('http://localhost:3000');

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
}

// Create window when app is ready
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  app.quit();
});

// Handle any errors
app.on('render-process-gone', (event, webContents, details) => {
  console.error('Render process gone:', details.reason);
  app.quit();
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  app.quit();
}); 