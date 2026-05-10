const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const GAME_DATA_PATH = path.join(__dirname, '../../server/game_data.json');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'RPG Balance Editor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
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

// IPC Handlers
ipcMain.handle('get-game-data', async () => {
  try {
    const data = fs.readFileSync(GAME_DATA_PATH, 'utf-8');
    return { success: true, data: JSON.parse(data) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-game-data', async (event, newJsonStr) => {
  try {
    // 1. Save File
    fs.writeFileSync(GAME_DATA_PATH, newJsonStr, 'utf-8');

    // 2. Git Commit and Push
    const cwd = path.join(__dirname, '../../');
    const addCmd = `git add server/game_data.json`;
    const commitCmd = `git commit -m "chore(balance): auto-save balance tweaks from editor"`;
    const pushCmd = `git push`;

    return new Promise((resolve) => {
      exec(`${addCmd} && ${commitCmd} && ${pushCmd}`, { cwd }, (error, stdout, stderr) => {
        if (error) {
          // It might fail if there's nothing to commit, which is fine
          console.warn(`Git error: ${error.message}`);
          resolve({ success: true, warning: 'Saved successfully, but git commit/push failed or had nothing to commit.' });
        } else {
          resolve({ success: true, message: 'Saved and pushed to GitHub successfully!' });
        }
      });
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});
