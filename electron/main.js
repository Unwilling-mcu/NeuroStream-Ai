const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  // Load the Vite dev server
  mainWindow.loadURL("http://localhost:5173");

  // Uncomment below to open DevTools for debugging:
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── IPC Handlers ─────────────────────────────────────────────────

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });

  if (result.canceled || !result.filePaths.length) return { canceled: true };

  const folderPath = result.filePaths[0];
  const supportedExts = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v", ".flv"];

  const files = fs.readdirSync(folderPath, { withFileTypes: true });
  const videos = files
    .filter(f => f.isFile() && supportedExts.includes(path.extname(f.name).toLowerCase()))
    .map((f, i) => ({
      id: i,
      title: path.basename(f.name, path.extname(f.name)),
      filename: f.name,
      file_path: path.join(folderPath, f.name),
      folder_path: folderPath,
      url: `file://${path.join(folderPath, f.name).replace(/\\/g, "/")}`,
    }));

  return { folderPath, videos };
});

ipcMain.handle("select-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [{ name: "Videos", extensions: ["mp4", "mkv", "avi", "mov", "webm", "m4v"] }],
  });

  if (result.canceled || !result.filePaths.length) return null;

  const filePath = result.filePaths[0];
  return {
    title: path.basename(filePath, path.extname(filePath)),
    filename: path.basename(filePath),
    file_path: filePath,
    folder_path: path.dirname(filePath),
    url: `file://${filePath.replace(/\\/g, "/")}`,
  };
});

ipcMain.on("window-minimize", () => mainWindow.minimize());
ipcMain.on("window-maximize", () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on("window-close", () => mainWindow.close());
ipcMain.on("open-external", (_, url) => shell.openExternal(url));