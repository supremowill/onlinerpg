const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    autoHideMenuBar: true, // Hide menu bar for a more immersive game feel
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false 
    }
  });

  // Load the game's production server (via AWS IP)
  mainWindow.loadURL('http://18.231.110.109');

  // Toggle fullscreen on F11
  mainWindow.on('focus', () => {
    globalShortcut.register('F11', () => {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    });
    // Open DevTools on F12
    globalShortcut.register('F12', () => {
      mainWindow.webContents.toggleDevTools();
    });
  });

  mainWindow.on('blur', () => {
    globalShortcut.unregister('F11');
    globalShortcut.unregister('F12');
  });
}

app.whenReady().then(async () => {
  const { session } = require('electron');
  // Clear the cache to ensure the latest version is downloaded from the server
  await session.defaultSession.clearCache();

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
