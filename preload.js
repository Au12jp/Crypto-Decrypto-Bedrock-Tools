const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld("electron", {
    getPacks: () => ipcRenderer.invoke('get-packs'),
    pickPath: (inputDir) => ipcRenderer.invoke('pick-path', inputDir),
})