const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const GAME_DATA_PATH = path.join(__dirname, '../../server/game_data.json');
const UPDATES_DATA_PATH = path.join(__dirname, '../../client/updates.json');

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

ipcMain.handle('get-updates-data', async () => {
  try {
    if (!fs.existsSync(UPDATES_DATA_PATH)) {
      fs.writeFileSync(UPDATES_DATA_PATH, '[]', 'utf-8');
    }
    const data = fs.readFileSync(UPDATES_DATA_PATH, 'utf-8');
    return { success: true, data: JSON.parse(data) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-all-data', async (event, gameDataStr, updatesDataStr) => {
  try {
    // 1. Save both files
    fs.writeFileSync(GAME_DATA_PATH, gameDataStr, 'utf-8');
    fs.writeFileSync(UPDATES_DATA_PATH, updatesDataStr, 'utf-8');

    // 2. Git Commit and Push
    const cwd = path.join(__dirname, '../../');
    const addCmd = `git add server/game_data.json client/updates.json`;
    const commitCmd = `git commit -m "chore(balance): auto-save balance tweaks and updates from editor"`;
    const pushCmd = `git push`;

    return new Promise((resolve) => {
      exec(`${addCmd} && ${commitCmd} && ${pushCmd}`, { cwd }, (gitError, gitStdout, gitStderr) => {
        let statusMsg = 'Saved and pushed to GitHub successfully!';
        if (gitError) {
          console.warn(`Git error: ${gitError.message}`);
          statusMsg = 'Saved successfully (Git push failed or nothing to commit).';
        }

        // Check for AWS key
        const keyPath = path.join(cwd, 'onlinerpg-key.pem');
        if (fs.existsSync(keyPath)) {
          console.log('AWS key found, starting SCP/SSH sync...');
          
          // Use absolute paths for the scp/ssh commands to avoid working directory issues
          const scpGame = `scp -i "${keyPath}" -o StrictHostKeyChecking=no "${GAME_DATA_PATH}" ubuntu@18.231.110.109:/home/ubuntu/onlinerpg/server/game_data.json`;
          const scpUpdates = `scp -i "${keyPath}" -o StrictHostKeyChecking=no "${UPDATES_DATA_PATH}" ubuntu@18.231.110.109:/home/ubuntu/onlinerpg/client/updates.json`;
          const restartApp = `ssh -i "${keyPath}" -o StrictHostKeyChecking=no ubuntu@18.231.110.109 "cd onlinerpg && docker compose restart app website"`;

          exec(`${scpGame} && ${scpUpdates} && ${restartApp}`, (awsError, awsStdout, awsStderr) => {
            if (awsError) {
              console.error(`AWS Sync error: ${awsError.message}`);
              resolve({
                success: true,
                warning: `${statusMsg} However, AWS deploy failed: ${awsError.message}`
              });
            } else {
              console.log('AWS Sync completed successfully');
              resolve({
                success: true,
                message: `${statusMsg} Also deployed & updated live on AWS server successfully!`
              });
            }
          });
        } else {
          resolve({ success: true, message: statusMsg });
        }
      });
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});
