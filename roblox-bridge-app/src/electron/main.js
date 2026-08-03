const { app, BrowserWindow } = require('electron');
const path = require('path');
const RobloxBridgeAppServer = require('../server/appServer');

let mainWindow = null;
let appServer = null;

async function createWindow() {
  // 1. Boot Backend Server Engine
  try {
    appServer = new RobloxBridgeAppServer({ port: 7777 });
    await appServer.start();
  } catch (err) {
    console.error('[Electron] Server init warning:', err.message);
  }

  // 2. Create Native Windows Desktop App Window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    backgroundColor: '#0f1117',
    title: 'Roblox Universal IDE Bridge',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadURL('http://localhost:7777');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
