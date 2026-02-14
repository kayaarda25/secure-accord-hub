const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;
let backupFolderPath = null;

// Persist backup folder path in a simple JSON config
const configPath = path.join(app.getPath('userData'), 'backup-config.json');

function loadBackupConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      backupFolderPath = data.backupFolder || null;
    }
  } catch { /* ignore */ }
}

function saveBackupConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify({ backupFolder: backupFolderPath }), 'utf8');
  } catch { /* ignore */ }
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, '../public/mgi-favicon.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: true,
    },
    titleBarStyle: 'default',
    show: false,
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Enable file downloads in Electron (file-saver uses blob URLs)
  mainWindow.webContents.session.on('will-download', (event, item) => {
    item.setSavePath('');
  });

  // Right-click context menu
  mainWindow.webContents.on('context-menu', (event, params) => {
    event.preventDefault();
    const contextMenu = [];

    // Text editing actions
    if (params.isEditable) {
      contextMenu.push(
        { label: 'Rückgängig', role: 'undo', enabled: params.editFlags.canUndo },
        { label: 'Wiederholen', role: 'redo', enabled: params.editFlags.canRedo },
        { type: 'separator' },
        { label: 'Ausschneiden', role: 'cut', enabled: params.editFlags.canCut },
        { label: 'Kopieren', role: 'copy', enabled: params.editFlags.canCopy },
        { label: 'Einfügen', role: 'paste', enabled: params.editFlags.canPaste },
        { label: 'Alles auswählen', role: 'selectAll', enabled: params.editFlags.canSelectAll },
      );
    } else if (params.selectionText) {
      contextMenu.push(
        { label: 'Kopieren', role: 'copy' },
        { label: 'Alles auswählen', role: 'selectAll' },
      );
    }

    // Link actions
    if (params.linkURL) {
      if (contextMenu.length > 0) contextMenu.push({ type: 'separator' });
      contextMenu.push(
        {
          label: 'Link im Browser öffnen',
          click: () => shell.openExternal(params.linkURL),
        },
        {
          label: 'Link kopieren',
          click: () => {
            const { clipboard } = require('electron');
            clipboard.writeText(params.linkURL);
          },
        },
      );
    }

    // Image actions
    if (params.hasImageContents) {
      if (contextMenu.length > 0) contextMenu.push({ type: 'separator' });
      contextMenu.push(
        {
          label: 'Bild kopieren',
          click: () => mainWindow.webContents.copyImageAt(params.x, params.y),
        },
      );
    }

    // Spelling suggestions
    if (params.misspelledWord) {
      if (contextMenu.length > 0) contextMenu.push({ type: 'separator' });
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
        contextMenu.push({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion),
        });
      }
      if (params.dictionarySuggestions.length === 0) {
        contextMenu.push({ label: 'Keine Vorschläge', enabled: false });
      }
    }

    // General actions (always available)
    if (contextMenu.length > 0) contextMenu.push({ type: 'separator' });
    contextMenu.push(
      { label: 'Neu laden', role: 'reload' },
      { label: 'Vollständig neu laden', role: 'forceReload' },
    );

    if (contextMenu.length > 0) {
      const menu = Menu.buildFromTemplate(contextMenu);
      menu.popup();
    }
  });

  // Create application menu
  const template = [
    {
      label: 'Datei',
      submenu: [
        { role: 'quit', label: 'Beenden' }
      ]
    },
    {
      label: 'Bearbeiten',
      submenu: [
        { role: 'undo', label: 'Rückgängig' },
        { role: 'redo', label: 'Wiederholen' },
        { type: 'separator' },
        { role: 'cut', label: 'Ausschneiden' },
        { role: 'copy', label: 'Kopieren' },
        { role: 'paste', label: 'Einfügen' },
        { role: 'selectAll', label: 'Alles auswählen' }
      ]
    },
    {
      label: 'Ansicht',
      submenu: [
        { role: 'reload', label: 'Neu laden' },
        { role: 'forceReload', label: 'Vollständig neu laden' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom zurücksetzen' },
        { role: 'zoomIn', label: 'Vergrössern' },
        { role: 'zoomOut', label: 'Verkleinern' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Vollbild' }
      ]
    },
    {
      label: 'Hilfe',
      submenu: [
        {
          label: 'Über MGI × AFRIKA',
          click: async () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Über MGI × AFRIKA',
              message: 'MGI × AFRIKA',
              detail: 'Government Cooperation Platform\nSecure Business Management\n\nVersion 1.0.0'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers for backup folder sync
ipcMain.handle('select-backup-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Backup-Ordner auswählen',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Ordner auswählen',
  });
  if (!result.canceled && result.filePaths.length > 0) {
    backupFolderPath = result.filePaths[0];
    saveBackupConfig();
    return backupFolderPath;
  }
  return null;
});

ipcMain.handle('get-backup-folder', () => backupFolderPath);

ipcMain.handle('clear-backup-folder', () => {
  backupFolderPath = null;
  saveBackupConfig();
  return true;
});

ipcMain.handle('save-backup-to-folder', async (_event, arrayBuffer, filename) => {
  if (!backupFolderPath) return { success: false, error: 'Kein Ordner ausgewählt' };
  try {
    const filePath = path.join(backupFolderPath, filename);
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// App lifecycle
app.whenReady().then(() => {
  loadBackupConfig();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent navigation to external URLs
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'file://') {
      event.preventDefault();
    }
  });
});
