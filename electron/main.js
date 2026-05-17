const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;
let splashWindow;

// ─── File extension lists ──────────────────────────────────────────
const VIDEO_EXTS = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v", ".flv"];
const AUDIO_EXTS = [".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a", ".wma", ".opus"];

function makeFileObj(filePath, folderPath, index, isAudio) {
  const name = path.basename(filePath);
  return {
    id: index,
    title: path.basename(name, path.extname(name)),
    filename: name,
    file_path: filePath,
    folder_path: folderPath,
    url: `file://${filePath.replace(/\\/g, "/")}`,
    isAudio: isAudio || false,
  };
}

// ─── Splash ────────────────────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 900, height: 600,
    frame: false, transparent: true,
    alwaysOnTop: true, resizable: false,
    center: true, skipTaskbar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWindow.loadFile(path.join(__dirname, "splash.html"));
}

// ─── Main window ───────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900,
    minWidth: 1000, minHeight: 700,
    backgroundColor: "#080808",
    show: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });
  // ── Spotify PKCE callback interceptor ─────────────────────────────
  // When Spotify redirects to http://127.0.0.1:5173/callback?code=...
  // Electron tries to load that URL as a new page → ERR_CONNECTION_REFUSED
  // → black screen. We intercept it BEFORE navigation happens, extract
  // the code (or error), and redirect back to the running Vite app at
  // localhost:5173 with the params appended as a query string.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    try {
      const parsed = new URL(url);
      if (parsed.pathname === "/callback" && (parsed.searchParams.has("code") || parsed.searchParams.has("error"))) {
        event.preventDefault();                         // stop Electron loading /callback
        const returnTo = `http://localhost:5173/?${parsed.searchParams.toString()}`;
        mainWindow.loadURL(returnTo);                   // send back to Vite with ?code=
      }
    } catch (_) {
      // not a valid URL — ignore
    }
  });

  mainWindow.loadURL("http://localhost:5173");
}

app.whenReady().then(() => {
  createSplash();
  createMainWindow();
  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) { splashWindow.close(); splashWindow = null; }
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  }, 4200);
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) { createSplash(); createMainWindow(); } });

// ─── IPC: Select folder ────────────────────────────────────────────
ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
  if (result.canceled || !result.filePaths.length) return { canceled: true };

  const folderPath = result.filePaths[0];
  let allFiles;
  try {
    allFiles = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch (e) {
    return { canceled: false, folderPath, videos: [], audios: [] };
  }

  const videos = [];
  const audios = [];
  let vidIdx = 0, audIdx = 0;

  for (const f of allFiles) {
    if (!f.isFile()) continue;
    const ext = path.extname(f.name).toLowerCase();
    const fullPath = path.join(folderPath, f.name);
    if (VIDEO_EXTS.includes(ext)) {
      videos.push(makeFileObj(fullPath, folderPath, vidIdx++, false));
    } else if (AUDIO_EXTS.includes(ext)) {
      audios.push(makeFileObj(fullPath, folderPath, audIdx++, true));
    }
  }

  return { canceled: false, folderPath, videos, audios };
});

// ─── IPC: Scan folder directly (no dialog) ────────────────────────
// Used for restoring the last folder on startup
ipcMain.handle("scan-folder", async (_, folderPath) => {
  if (!folderPath) return { error: "No path provided" };

  let allFiles;
  try {
    allFiles = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch (e) {
    return { error: "Folder not accessible: " + e.message };
  }

  const videos = [];
  const audios = [];
  let vidIdx = 0, audIdx = 0;

  for (const f of allFiles) {
    if (!f.isFile()) continue;
    const ext = path.extname(f.name).toLowerCase();
    const fullPath = path.join(folderPath, f.name);
    if (VIDEO_EXTS.includes(ext)) {
      videos.push(makeFileObj(fullPath, folderPath, vidIdx++, false));
    } else if (AUDIO_EXTS.includes(ext)) {
      audios.push(makeFileObj(fullPath, folderPath, audIdx++, true));
    }
  }

  return { folderPath, videos, audios };
});

// ─── IPC: Select single file ───────────────────────────────────────
ipcMain.handle("select-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "Media Files", extensions: ["mp4","mkv","avi","mov","webm","m4v","flv","mp3","flac","wav","aac","ogg","m4a","wma"] },
      { name: "Videos", extensions: ["mp4","mkv","avi","mov","webm","m4v","flv"] },
      { name: "Audio",  extensions: ["mp3","flac","wav","aac","ogg","m4a","wma"] },
    ],
  });
  if (result.canceled || !result.filePaths.length) return null;

  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase();
  const isAudio = AUDIO_EXTS.includes(ext);

  return {
    title: path.basename(filePath, ext),
    filename: path.basename(filePath),
    file_path: filePath,
    folder_path: path.dirname(filePath),
    url: `file://${filePath.replace(/\\/g, "/")}`,
    isAudio,
  };
});

// ─── IPC: Window controls ──────────────────────────────────────────
ipcMain.on("window-minimize",  () => mainWindow?.minimize());
ipcMain.on("window-maximize",  () => { mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize(); });
ipcMain.on("window-close",     () => mainWindow?.close());
ipcMain.on("window-fullscreen",() => mainWindow?.setFullScreen(!mainWindow.isFullScreen()));
ipcMain.on("open-external",    (_, url) => shell.openExternal(url));