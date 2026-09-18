const { contextBridge, ipcRenderer } = require('electron');

// Expose safe desktop bridge to renderer window
contextBridge.exposeInMainWorld('bloxSyncDesktop', {
  isElectron: true,
  platform: process.platform,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizedChange: (callback) => {
    if (typeof callback === 'function') {
      ipcRenderer.on('window-maximized-changed', (_event, isMaximized) => {
        callback(isMaximized);
      });
    }
  }
});
