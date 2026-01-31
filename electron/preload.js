const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,
  
  // App version
  getVersion: () => ipcRenderer.invoke('get-version'),
  
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  
  // File system operations (if needed later)
  saveFile: (data, filename) => ipcRenderer.invoke('save-file', data, filename),
  openFile: () => ipcRenderer.invoke('open-file'),
});

// Log that preload script has loaded
console.log('Electron preload script loaded');
