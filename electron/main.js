const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

let mainWindow;
let splashWindow;
let backendProcess = null;

// ─── File extension lists ──────────────────────────────────────────
const VIDEO_EXTS = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v", ".flv"];
const AUDIO_EXTS = [".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a", ".wma", ".opus"];

const isDev = !app.isPackaged;

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


// ─── Start backend inside Electron's Node.js runtime ─────────────
// This avoids needing an external node.exe on PATH.
// Because server.js is now CJS, we can load it directly via Module._load
// after setting up the right __dirname context.
function startBackend() {
  if (isDev) return; // In dev, user runs backend manually

  const backendPath = path.join(process.resourcesPath, "backend", "server.js");
  if (!fs.existsSync(backendPath)) {
    console.error("Backend not found at:", backendPath);
    return;
  }

  const userDataPath = app.getPath("userData");

  // Migrate old DB if needed
  const oldDb = path.join(process.resourcesPath, "backend", "neurostream-db.json");
  const newDb = path.join(userDataPath, "neurostream-db.json");
  if (fs.existsSync(oldDb) && !fs.existsSync(newDb)) {
    try { fs.copyFileSync(oldDb, newDb); } catch {}
  }

  // Set env vars the backend reads
  process.env.USER_DATA_PATH = userDataPath;
  process.env.NODE_ENV = "production";
  process.env.BACKEND_DIR = path.join(process.resourcesPath, "backend");
  process.env.RESOURCES_PATH = process.resourcesPath;

  try {
    // Load backend directly in this process using Node's Module system
    const Module = require("module");
    const backendModule = new Module(backendPath);
    backendModule.filename = backendPath;
    backendModule.paths = Module._nodeModulePaths(path.dirname(backendPath));
    backendModule._compile(fs.readFileSync(backendPath, "utf8"), backendPath);
    console.log("✅ Backend started inline");
  } catch (err) {
    console.error("❌ Backend failed to start:", err.message);
    // Fallback: try spawning with process.execPath (Electron binary can run as node)
    const { spawn } = require("child_process");
    const child = spawn(process.execPath, ["--require", backendPath], {
      cwd: path.join(process.resourcesPath, "backend"),
      stdio: "pipe",
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    });
    child.stdout?.on("data", d => console.log("[backend]", d.toString().trim()));
    child.stderr?.on("data", d => console.error("[backend]", d.toString().trim()));
  }
}

// ─── Start backend inside Electron's Node.js runtime ─────────────
// This avoids needing an external node.exe on PATH.
// Because server.js is now CJS, we can load it directly via Module._load
// after setting up the right __dirname context.

// ─── Splash// ─── Splash ────────────────────────────────────────────────────────
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


// ─── Wait for backend to be ready on port 5000 ────────────────────
function waitForBackend(onReady, attempts = 0) {
  const http = require("http");
  const MAX = 30; // 30 × 500ms = 15s max wait
  http.get("http://localhost:5000/api/history", (res) => {
    onReady(); // backend responded — load the UI
  }).on("error", () => {
    if (attempts < MAX) {
      setTimeout(() => waitForBackend(onReady, attempts + 1), 500);
    } else {
      // Timeout — load anyway and let the UI show its error states
      onReady();
    }
  });
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
  mainWindow.webContents.on("will-navigate", (event, url) => {
    try {
      const parsed = new URL(url);
      if (parsed.pathname === "/callback" &&
         (parsed.searchParams.has("code") || parsed.searchParams.has("error"))) {
        event.preventDefault();
        if (isDev) {
          mainWindow.loadURL(`http://localhost:5173/?${parsed.searchParams.toString()}`);
        } else {
          mainWindow.loadFile(
            path.join(__dirname, "../frontend/dist/index.html"),
            { search: "?" + parsed.searchParams.toString() }
          );
        }
      }
    } catch (_) {}
  });

  // ── Load app ───────────────────────────────────────────────────────
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    // Poll until backend is ready (max 15s), then load the UI
    waitForBackend(() => {
      mainWindow.loadFile(path.join(__dirname, "../frontend/dist/index.html"));
    });
  }
}

// ─── App lifecycle ─────────────────────────────────────────────────
app.whenReady().then(() => {
  startBackend();
  createSplash();
  createMainWindow();

  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  }, 4200);
});

app.on("window-all-closed", () => {
  if (backendProcess) { backendProcess.kill(); backendProcess = null; }
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) { createSplash(); createMainWindow(); }
});

// ─── IPC: Select folder ────────────────────────────────────────────
ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
  if (result.canceled || !result.filePaths.length) return { canceled: true };

  const folderPath = result.filePaths[0];
  let allFiles;
  try { allFiles = fs.readdirSync(folderPath, { withFileTypes: true }); }
  catch (e) { return { canceled: false, folderPath, videos: [], audios: [] }; }

  const videos = [], audios = [];
  let vidIdx = 0, audIdx = 0;
  for (const f of allFiles) {
    if (!f.isFile()) continue;
    const ext = path.extname(f.name).toLowerCase();
    const fullPath = path.join(folderPath, f.name);
    if (VIDEO_EXTS.includes(ext)) videos.push(makeFileObj(fullPath, folderPath, vidIdx++, false));
    else if (AUDIO_EXTS.includes(ext)) audios.push(makeFileObj(fullPath, folderPath, audIdx++, true));
  }
  return { canceled: false, folderPath, videos, audios };
});

// ─── IPC: Scan folder directly ────────────────────────────────────
ipcMain.handle("scan-folder", async (_, folderPath) => {
  if (!folderPath) return { error: "No path provided" };
  let allFiles;
  try { allFiles = fs.readdirSync(folderPath, { withFileTypes: true }); }
  catch (e) { return { error: "Folder not accessible: " + e.message }; }

  const videos = [], audios = [];
  let vidIdx = 0, audIdx = 0;
  for (const f of allFiles) {
    if (!f.isFile()) continue;
    const ext = path.extname(f.name).toLowerCase();
    const fullPath = path.join(folderPath, f.name);
    if (VIDEO_EXTS.includes(ext)) videos.push(makeFileObj(fullPath, folderPath, vidIdx++, false));
    else if (AUDIO_EXTS.includes(ext)) audios.push(makeFileObj(fullPath, folderPath, audIdx++, true));
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
  return {
    title: path.basename(filePath, ext),
    filename: path.basename(filePath),
    file_path: filePath,
    folder_path: path.dirname(filePath),
    url: `file://${filePath.replace(/\\/g, "/")}`,
    isAudio: AUDIO_EXTS.includes(ext),
  };
});

// ─── IPC: Window controls ──────────────────────────────────────────
ipcMain.on("window-minimize",   () => mainWindow?.minimize());
ipcMain.on("window-maximize",   () => { mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize(); });
ipcMain.on("window-close",      () => mainWindow?.close());
ipcMain.on("window-fullscreen", () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()));
ipcMain.on("open-external",     (_, url) => shell.openExternal(url));