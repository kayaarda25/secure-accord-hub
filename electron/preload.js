const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,
  isElectron: true,
  
  // App version
  getVersion: () => ipcRenderer.invoke('get-version'),
  
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  
  // File system operations
  saveFile: (data, filename) => ipcRenderer.invoke('save-file', data, filename),
  openFile: () => ipcRenderer.invoke('open-file'),

  // Open URL in system browser
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Backup folder sync
  selectBackupFolder: () => ipcRenderer.invoke('select-backup-folder'),
  getBackupFolder: () => ipcRenderer.invoke('get-backup-folder'),
  clearBackupFolder: () => ipcRenderer.invoke('clear-backup-folder'),
  saveBackupToFolder: (arrayBuffer, filename) => ipcRenderer.invoke('save-backup-to-folder', arrayBuffer, filename),
});

// Log that preload script has loaded
console.log('Electron preload script loaded');
