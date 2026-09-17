const { app, BrowserWindow, shell } = require('electron');
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
    width: 960,
    height: 600,
    minWidth: 760,
    minHeight: 480,
    backgroundColor: '#0f1117',
    title: 'Roblox Universal IDE Bridge v2.2',
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
    mainWindow.focus();
  });

  // Fallback to ensure window is visible even if ready-to-show is delayed
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  }, 1000);

  // Open external links in the default browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
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
