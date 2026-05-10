const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getGameData: () => ipcRenderer.invoke('get-game-data'),
  saveGameData: (jsonStr) => ipcRenderer.invoke('save-game-data', jsonStr)
});
