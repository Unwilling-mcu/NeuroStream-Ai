const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // File system
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  selectFile: () => ipcRenderer.invoke("select-file"),

  // Window controls
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  toggleFullscreen: () => ipcRenderer.send("window-fullscreen"),

  // Utility
  openExternal: (url) => ipcRenderer.send("open-external", url),

  // Platform info
  platform: process.platform,
});