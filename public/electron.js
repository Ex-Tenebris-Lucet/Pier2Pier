const { app, BrowserWindow } = require('electron');
const path = require('path');
const WebSocket = require('ws');

let mainWindow;
let wsClient;

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

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
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

  mainWindow.loadURL('http://127.0.0.1:3000')
    .then(() => mainWindow.show())
    .catch(() => app.quit());

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (wsClient) wsClient.close();
    app.quit();
  });
}

app.whenReady().then(connectToDevServer);

app.on('window-all-closed', () => {
  if (wsClient) wsClient.close();
  app.quit();
}); 