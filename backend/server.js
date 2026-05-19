const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { execFileSync, execSync } = require("child_process");
// __dirname is natively available in CJS
const app = express();
app.use(cors());
app.use(express.json());

// ─── Thumbnail cache dir ───────────────────────────────────────────
const THUMB_DIR = path.join(__dirname, "thumbnails");
if (!fs.existsSync(THUMB_DIR)) fs.mkdirSync(THUMB_DIR, { recursive: true });

// ─── Pure JSON DB ──────────────────────────────────────────────────
// In production, USER_DATA_PATH is passed by Electron main.js so the DB
// is stored in AppData/Roaming/NeuroStream AI (writable, survives updates).
// In dev it falls back to the backend folder itself.
const DB_PATH = process.env.USER_DATA_PATH
  ? path.join(process.env.USER_DATA_PATH, "neurostream-db.json")
  : path.join(__dirname, "neurostream-db.json");
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ history: [], library: [] }, null, 2));
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  } catch { return { history: [], library: [] }; }
}
function writeDB(data) {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); } catch (e) { console.error("DB write:", e.message); }
}

// ─── ffprobe ───────────────────────────────────────────────────────
let ffprobeExec = null;
let ffmpegExec = null;
try {
  const mod = require("ffprobe-static");
  ffprobeExec = mod?.path ?? mod?.default?.path ?? null;
  // Derive ffmpeg path from ffprobe path
  ffmpegExec = ffprobeExec?.replace("ffprobe", "ffmpeg") || null;
  // Check if ffmpeg exists
  if (ffmpegExec && !fs.existsSync(ffmpegExec)) {
    // Try system ffmpeg
    try { execSync("ffmpeg -version", { stdio: "pipe" }); ffmpegExec = "ffmpeg"; } catch { ffmpegExec = null; }
  }
  console.log("✅ ffprobe:", ffprobeExec ? "found" : "missing");
  console.log("✅ ffmpeg:", ffmpegExec ? "found" : "missing (thumbnails disabled)");
} catch { console.warn("⚠️  ffprobe-static not found"); }

function getVideoMetadata(filePath) {
  if (!ffprobeExec) return { duration: 0, size: 0, resolution: "Unknown" };
  try {
    const out = execFileSync(ffprobeExec, [
      "-v", "quiet", "-print_format", "json",
      "-show_format", "-show_streams", filePath
    ], { timeout: 8000 });
    const data = JSON.parse(out.toString());
    const vs = data.streams?.find(s => s.codec_type === "video");
    return {
      duration: parseFloat(data.format?.duration || 0),
      size: parseInt(data.format?.size || 0),
      resolution: vs?.width && vs?.height ? `${vs.width}x${vs.height}` : "Unknown",
      fps: vs?.r_frame_rate ? eval(vs.r_frame_rate).toFixed(1) : null,
      codec: vs?.codec_name || null,
    };
  } catch { return { duration: 0, size: 0, resolution: "Unknown" }; }
}

// ─── Thumbnail generation ──────────────────────────────────────────
function getThumbnailPath(filePath) {
  const hash = Buffer.from(filePath).toString("base64").replace(/[/+=]/g, "_").slice(0, 40);
  return path.join(THUMB_DIR, `${hash}.jpg`);
}

async function generateThumbnail(filePath, thumbPath) {
  if (!ffmpegExec) return null;
  return new Promise((resolve) => {
    try {
      const { default: ffmpeg } = require("fluent-ffmpeg");
      ffmpeg(filePath)
        .screenshots({
          timestamps: ["10%"],
          filename: path.basename(thumbPath),
          folder: THUMB_DIR,
          size: "320x180",
        })
        .on("end", () => resolve(thumbPath))
        .on("error", () => resolve(null));
    } catch { resolve(null); }
  });
}

// ─── Audio metadata + album art ────────────────────────────────────
const AUDIO_EXTS = [".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a", ".wma", ".opus"];
const ALBUM_ART_DIR = path.join(__dirname, "album-art");
if (!fs.existsSync(ALBUM_ART_DIR)) fs.mkdirSync(ALBUM_ART_DIR, { recursive: true });

function getAlbumArtPath(filePath) {
  const hash = Buffer.from(filePath).toString("base64").replace(/[/+=]/g, "_").slice(0, 40);
  return path.join(ALBUM_ART_DIR, `${hash}.jpg`);
}

function getAudioMetadata(filePath) {
  if (!ffprobeExec) return { duration: 0, size: 0, title: null, artist: null, album: null };
  try {
    const out = execFileSync(ffprobeExec, [
      "-v", "quiet", "-print_format", "json",
      "-show_format", "-show_streams", filePath
    ], { timeout: 8000 });
    const data = JSON.parse(out.toString());
    const tags = data.format?.tags || {};
    const size = parseInt(data.format?.size || 0);
    const duration = parseFloat(data.format?.duration || 0);

    // Check if there's an embedded image stream (album art)
    const hasArt = data.streams?.some(s =>
      s.codec_type === "video" && (s.codec_name === "mjpeg" || s.codec_name === "png" || s.disposition?.attached_pic === 1)
    );

    return {
      duration,
      size,
      hasEmbeddedArt: !!hasArt,
      title:  tags.title  || tags.TITLE  || null,
      artist: tags.artist || tags.ARTIST || tags.album_artist || null,
      album:  tags.album  || tags.ALBUM  || null,
    };
  } catch { return { duration: 0, size: 0, hasEmbeddedArt: false, title: null, artist: null, album: null }; }
}

async function extractAlbumArt(filePath, artPath) {
  if (!ffmpegExec || fs.existsSync(artPath)) return fs.existsSync(artPath) ? artPath : null;
  return new Promise(resolve => {
    try {
      const { default: ffmpeg } = require("fluent-ffmpeg");
      ffmpeg(filePath)
        .outputOptions(["-an", "-vcodec", "copy"])
        .output(artPath)
        .on("end", () => resolve(artPath))
        .on("error", () => resolve(null))
        .run();
    } catch { resolve(null); }
  });
}

// ─── Scan folder ───────────────────────────────────────────────────
const SUPPORTED = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v", ".flv"];

function scanFolder(folderPath) {
  try {
    const allFiles = fs.readdirSync(folderPath, { withFileTypes: true })
      .filter(f => f.isFile());

    const results = [];

    allFiles.forEach((f, i) => {
      const ext = path.extname(f.name).toLowerCase();
      const filePath = path.join(folderPath, f.name);

      if (SUPPORTED.includes(ext)) {
        // Video file
        const meta = getVideoMetadata(filePath);
        const thumbPath = getThumbnailPath(filePath);
        const hasCachedThumb = fs.existsSync(thumbPath);
        results.push({
          id: i,
          title: path.basename(f.name, ext),
          filename: f.name,
          file_path: filePath,
          folder_path: folderPath,
          url: `http://localhost:5000/api/stream/${encodeURIComponent(f.name)}?folder=${encodeURIComponent(folderPath)}`,
          thumbnail: hasCachedThumb
            ? `http://localhost:5000/api/thumbnail/${encodeURIComponent(path.basename(thumbPath))}`
            : null,
          isAudio: false,
          ...meta,
        });

      } else if (AUDIO_EXTS.includes(ext)) {
        // Audio file
        const meta = getAudioMetadata(filePath);
        const artPath = getAlbumArtPath(filePath);
        const hasCachedArt = fs.existsSync(artPath);
        const displayTitle = meta.title || path.basename(f.name, ext);

        results.push({
          id: i + 10000,
          title: displayTitle,
          filename: f.name,
          file_path: filePath,
          folder_path: folderPath,
          url: `http://localhost:5000/api/stream/${encodeURIComponent(f.name)}?folder=${encodeURIComponent(folderPath)}`,
          albumArt: (hasCachedArt || meta.hasEmbeddedArt)
            ? `http://localhost:5000/api/album-art/${encodeURIComponent(path.basename(artPath))}`
            : null,
          isAudio: true,
          artist: meta.artist,
          album:  meta.album,
          duration: meta.duration,
          size: meta.size,
          hasEmbeddedArt: meta.hasEmbeddedArt,
        });
      }
    });

    return results;
  } catch (e) { console.error("Scan error:", e.message); return []; }
}

// ─── Album art endpoint ────────────────────────────────────────────
app.get("/api/album-art/:filename", (req, res) => {
  const artPath = path.join(ALBUM_ART_DIR, decodeURIComponent(req.params.filename));
  if (!fs.existsSync(artPath)) return res.status(404).send("Not found");
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=86400");
  fs.createReadStream(artPath).pipe(res);
});

// Generate album art on demand
app.get("/api/album-art-generate", async (req, res) => {
  const { file_path } = req.query;
  if (!file_path || !fs.existsSync(file_path)) return res.status(400).json({ error: "Invalid path" });

  const artPath = getAlbumArtPath(file_path);

  if (fs.existsSync(artPath)) {
    return res.json({ url: `http://localhost:5000/api/album-art/${encodeURIComponent(path.basename(artPath))}` });
  }

  const result = await extractAlbumArt(file_path, artPath);
  if (result) {
    res.json({ url: `http://localhost:5000/api/album-art/${encodeURIComponent(path.basename(artPath))}` });
  } else {
    res.status(404).json({ error: "No album art found" });
  }
});

// ─── Routes ───────────────────────────────────────────────────────

app.get("/api/health", (_, res) => res.json({ status: "ok", version: "3.0.0", ffmpeg: !!ffmpegExec }));

// Default media folder
app.get("/api/videos", (_, res) => {
  const dir = path.join(process.cwd(), "../media");
  if (!fs.existsSync(dir)) return res.json([]);
  res.json(scanFolder(dir));
});

// Scan + index folder
app.get("/api/scan", async (req, res) => {
  const { folder } = req.query;
  if (!folder || !fs.existsSync(folder)) return res.status(400).json({ error: "Invalid folder" });

  const videos = scanFolder(folder);

  // Save to library
  const db = readDB();
  for (const v of videos) {
    if (!db.library.find(l => l.file_path === v.file_path)) {
      db.library.push({ ...v, added_at: Date.now() });
    }
  }
  writeDB(db);

  // Send response immediately, generate thumbnails + album art in background
  res.json(videos);

  // Background thumbnail generation for videos
  for (const v of videos) {
    if (!v.isAudio) {
      const thumbPath = getThumbnailPath(v.file_path);
      if (!fs.existsSync(thumbPath)) {
        generateThumbnail(v.file_path, thumbPath).catch(() => {});
      }
    } else if (v.hasEmbeddedArt) {
      // Background album art extraction for audio
      const artPath = getAlbumArtPath(v.file_path);
      if (!fs.existsSync(artPath)) {
        extractAlbumArt(v.file_path, artPath).catch(() => {});
      }
    }
  }
});

// ─── Thumbnail endpoint ────────────────────────────────────────────
app.get("/api/thumbnail/:filename", (req, res) => {
  const thumbPath = path.join(THUMB_DIR, decodeURIComponent(req.params.filename));
  if (!fs.existsSync(thumbPath)) return res.status(404).send("Not found");
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=86400");
  fs.createReadStream(thumbPath).pipe(res);
});

// Generate thumbnail on demand
app.get("/api/thumbnail-generate", async (req, res) => {
  const { file_path } = req.query;
  if (!file_path || !fs.existsSync(file_path)) return res.status(400).json({ error: "Invalid path" });
  const thumbPath = getThumbnailPath(file_path);
  if (fs.existsSync(thumbPath)) {
    return res.json({ url: `http://localhost:5000/api/thumbnail/${encodeURIComponent(path.basename(thumbPath))}` });
  }
  const result = await generateThumbnail(file_path, thumbPath);
  if (result) {
    res.json({ url: `http://localhost:5000/api/thumbnail/${encodeURIComponent(path.basename(thumbPath))}` });
  } else {
    res.status(500).json({ error: "Thumbnail generation failed" });
  }
});

// ─── Screenshot from video at timestamp ───────────────────────────
app.get("/api/screenshot", async (req, res) => {
  const { file_path, time } = req.query;
  if (!file_path || !fs.existsSync(file_path)) return res.status(400).json({ error: "Invalid path" });
  if (!ffmpegExec) return res.status(503).json({ error: "ffmpeg not available" });

  const screenshotPath = path.join(THUMB_DIR, `screenshot_${Date.now()}.png`);
  try {
    const { default: ffmpeg } = require("fluent-ffmpeg");
    await new Promise((resolve, reject) => {
      ffmpeg(file_path)
        .screenshots({
          timestamps: [parseFloat(time || 0)],
          filename: path.basename(screenshotPath),
          folder: THUMB_DIR,
        })
        .on("end", resolve)
        .on("error", reject);
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `attachment; filename="screenshot.png"`);
    const stream = fs.createReadStream(screenshotPath);
    stream.pipe(res);
    stream.on("end", () => {
      setTimeout(() => fs.unlink(screenshotPath, () => {}), 3000);
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Video streaming ───────────────────────────────────────────────
app.get("/api/stream/:filename", (req, res) => {
  const folder = req.query.folder || path.join(process.cwd(), "../media");
  const filePath = path.join(folder, decodeURIComponent(req.params.filename));
  if (!fs.existsSync(filePath)) return res.status(404).send("File not found");

  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const MIME = {
    ".mp4": "video/mp4", ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo", ".mov": "video/quicktime",
    ".webm": "video/webm", ".m4v": "video/mp4", ".flv": "video/x-flv",
  };
  const contentType = MIME[ext] || "video/mp4";
  const range = req.headers.range;

  if (!range) {
    res.writeHead(200, { "Content-Length": stat.size, "Content-Type": contentType, "Accept-Ranges": "bytes" });
    fs.createReadStream(filePath).pipe(res);
    return;
  }
  const [s, e] = range.replace(/bytes=/, "").split("-");
  const start = parseInt(s, 10);
  const end = e ? parseInt(e, 10) : stat.size - 1;
  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${stat.size}`,
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1,
    "Content-Type": contentType,
  });
  fs.createReadStream(filePath, { start, end }).pipe(res);
});

// ─── Network URL proxy (avoid CORS issues) ────────────────────────
app.get("/api/proxy-stream", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send("No URL");
  try {
    const fetch = require("node-fetch").default || require("node-fetch");
    const headers = {};
    if (req.headers.range) headers["Range"] = req.headers.range;
    const upstream = await fetch(url, { headers });
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "video/mp4",
      "Content-Length": upstream.headers.get("content-length") || "",
      "Accept-Ranges": "bytes",
      "Content-Range": upstream.headers.get("content-range") || "",
    });
    upstream.body.pipe(res);
  } catch (e) {
    res.status(500).send("Proxy error: " + e.message);
  }
});

// ─── Chapters (MKV + MP4) ─────────────────────────────────────────
app.get("/api/chapters", (req, res) => {
  const { file_path } = req.query;
  if (!file_path || !fs.existsSync(file_path)) return res.status(400).json({ error: "Invalid path" });
  if (!ffprobeExec) return res.json([]);
  try {
    const out = execFileSync(ffprobeExec, [
      "-v", "quiet",
      "-print_format", "json",
      "-show_chapters",
      file_path
    ], { timeout: 8000 });
    const data = JSON.parse(out.toString());
    const chapters = (data.chapters || []).map((c, i) => ({
      id: i,
      title: c.tags?.title || c.tags?.TITLE || `Chapter ${i + 1}`,
      start: parseFloat(c.start_time || 0),
      end: parseFloat(c.end_time || 0),
    }));
    res.json(chapters);
  } catch (e) {
    res.json([]); // No chapters — not an error
  }
});

// ─── Subtitles ─────────────────────────────────────────────────────
app.get("/api/subtitle/:filename", (req, res) => {
  const folder = req.query.folder || path.join(process.cwd(), "../media");
  const base = path.basename(decodeURIComponent(req.params.filename), path.extname(req.params.filename));
  for (const ext of [".vtt", ".srt"]) {
    const p = path.join(folder, base + ext);
    if (fs.existsSync(p)) {
      res.setHeader("Content-Type", ext === ".vtt" ? "text/vtt" : "text/plain");
      return res.sendFile(p);
    }
  }
  res.status(404).send("No subtitle");
});

// ─── Watch History ──────────────────────────────────────────────────
app.get("/api/history", (_, res) => {
  const db = readDB();
  res.json([...db.history].sort((a, b) => b.last_watched - a.last_watched).slice(0, 100));
});

app.post("/api/history", (req, res) => {
  const { title, file_path, progress, duration } = req.body;
  const db = readDB();
  const idx = db.history.findIndex(h => h.file_path === file_path);
  if (idx >= 0) {
    db.history[idx] = { ...db.history[idx], progress, duration, last_watched: Date.now(), watch_count: (db.history[idx].watch_count || 0) + 1 };
  } else {
    db.history.push({ id: Date.now(), title, file_path, progress, duration, last_watched: Date.now(), watch_count: 1 });
  }
  writeDB(db);
  res.json({ ok: true });
});

app.delete("/api/history/:id", (req, res) => {
  const db = readDB();
  db.history = db.history.filter(h => String(h.id) !== String(req.params.id));
  writeDB(db);
  res.json({ ok: true });
});

app.delete("/api/history", (_, res) => {
  const db = readDB();
  db.history = [];
  writeDB(db);
  res.json({ ok: true });
});

// ─── Library & Search ──────────────────────────────────────────────

// Remove a single video from library by file_path
app.delete("/api/library", (req, res) => {
  const { file_path } = req.body;
  if (!file_path) return res.status(400).json({ error: "file_path required" });
  const db = readDB();
  const before = db.library.length;
  db.library = db.library.filter(v => v.file_path !== file_path);
  writeDB(db);
  res.json({ ok: true, removed: before - db.library.length });
});

app.get("/api/library", (_, res) => {
  const db = readDB();
  res.json([...db.library].sort((a, b) => b.added_at - a.added_at));
});

app.get("/api/search", (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  const db = readDB();
  res.json(db.library.filter(v => v.title.toLowerCase().includes(q)).slice(0, 50));
});


// ─── YouTube Music via yt-dlp ──────────────────────────────────────

function getYtDlp() {
  const os = require("os");
  const ext = process.platform === "win32" ? ".exe" : "";

  // Priority 1: BACKEND_DIR set by main.js — most reliable in packaged app
  // because __dirname is wrong when server.js is loaded via Module._compile
  if (process.env.BACKEND_DIR) {
    const p = path.join(process.env.BACKEND_DIR, "yt-dlp" + ext);
    if (fs.existsSync(p)) return p;
  }

  // Priority 2: resourcesPath from main.js (also set as env var)
  if (process.env.RESOURCES_PATH) {
    const p = path.join(process.env.RESOURCES_PATH, "backend", "yt-dlp" + ext);
    if (fs.existsSync(p)) return p;
  }

  // Priority 3: next to server.js (__dirname — works in dev)
  const local = path.join(__dirname, "yt-dlp" + ext);
  if (fs.existsSync(local)) return local;

  // Priority 4: PATH and common pip install locations
  const candidates = [
    "yt-dlp",
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python311", "Scripts", "yt-dlp.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python312", "Scripts", "yt-dlp.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python313", "Scripts", "yt-dlp.exe"),
    path.join(process.env.APPDATA || "", "Python", "Scripts", "yt-dlp.exe"),
    path.join(os.homedir(), "scoop", "shims", "yt-dlp.exe"),
    "/usr/local/bin/yt-dlp", "/usr/bin/yt-dlp",
  ];
  for (const c of candidates) {
    try {
      require("child_process").execSync(`"${c}" --version`, { stdio: "pipe", timeout: 4000 });
      return c;
    } catch {}
  }
  return null;
}

function ytDlpSearch(ytdlp, query, maxResults = 20) {
  const raw = execFileSync(ytdlp, [
    `ytsearch${maxResults}:${query}`,
    "--dump-json", "--flat-playlist", "--no-warnings",
    "--match-filter", "duration < 600",
  ], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });

  return raw.toString().trim().split("\n")
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean)
    .map(v => ({
      id:        v.id,
      title:     v.title,
      channel:   v.channel || v.uploader || "",
      duration:  v.duration || 0,
      thumbnail: v.thumbnail || (v.thumbnails?.[0]?.url) || null,
      views:     v.view_count ? Intl.NumberFormat("en", { notation: "compact" }).format(v.view_count) : null,
    }));
}

// GET /api/yt/search?q=<query>
app.get("/api/yt/search", (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "q is required" });
  const ytdlp = getYtDlp();
  if (!ytdlp) return res.status(503).json({ error: "yt-dlp not found. Install: pip install yt-dlp" });
  try {
    const tracks = ytDlpSearch(ytdlp, `${q} audio`, 20);
    res.json({ tracks });
  } catch (e) {
    console.error("yt search error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/yt/trending
app.get("/api/yt/trending", (req, res) => {
  const ytdlp = getYtDlp();
  if (!ytdlp) return res.status(503).json({ error: "yt-dlp not found. Install: pip install yt-dlp" });
  try {
    const raw = execFileSync(ytdlp, [
      "https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI",
      "--dump-json", "--flat-playlist", "--no-warnings", "--playlist-end", "30",
    ], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });

    const tracks = raw.toString().trim().split("\n")
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean)
      .map(v => ({
        id: v.id, title: v.title,
        channel: v.channel || v.uploader || "",
        duration: v.duration || 0,
        thumbnail: v.thumbnail || (v.thumbnails?.[0]?.url) || null,
        views: v.view_count ? Intl.NumberFormat("en", { notation: "compact" }).format(v.view_count) : null,
      }));
    res.json({ tracks });
  } catch (e) {
    // Fallback to search
    try {
      const tracks = ytDlpSearch(ytdlp, "top music hits 2025 official", 25);
      res.json({ tracks });
    } catch (e2) {
      res.status(500).json({ error: e2.message });
    }
  }
});

// GET /api/yt/stream-url?id=<videoId>
app.get("/api/yt/stream-url", (req, res) => {
  const id = (req.query.id || "").trim();
  if (!id) return res.status(400).json({ error: "id is required" });
  const ytdlp = getYtDlp();
  if (!ytdlp) return res.status(503).json({ error: "yt-dlp not found" });
  try {
    const url = execFileSync(ytdlp, [
      `https://www.youtube.com/watch?v=${id}`,
      "-f", "bestaudio[ext=m4a]/bestaudio/best",
      "--get-url", "--no-warnings",
    ], { timeout: 20000 }).toString().trim().split("\n")[0];
    if (!url || !url.startsWith("http")) throw new Error("No stream URL returned");
    res.json({ url });
  } catch (e) {
    console.error("yt stream-url error:", e.message);
    res.status(500).json({ error: e.message });
  }
});


// ─── Watch Together — WebSocket Room Server ────────────────────────
// Rooms: Map<roomId, Set<WebSocket>>
// Each message: { type, roomId, ...payload }
// Types: join | leave | play | pause | seek | video | ping | peers

const { WebSocketServer } = require("ws");
const rooms = new Map(); // roomId → Set of ws clients

function broadcast(roomId, msg, exclude = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  const data = JSON.stringify(msg);
  for (const client of room) {
    if (client !== exclude && client.readyState === 1) {
      client.send(data);
    }
  }
}

function sendPeerCount(roomId) {
  const count = rooms.get(roomId)?.size || 0;
  const room = rooms.get(roomId);
  if (!room) return;
  const data = JSON.stringify({ type: "peers", count });
  for (const client of room) {
    if (client.readyState === 1) client.send(data);
  }
}

const server = app.listen(5000, () => {
  console.log("🚀 NeuroStream backend → http://localhost:5000");
  console.log("📁 Thumbnails →", THUMB_DIR);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let currentRoom = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const { type, roomId } = msg;

    if (type === "join") {
      // Leave old room if switching
      if (currentRoom && currentRoom !== roomId) {
        rooms.get(currentRoom)?.delete(ws);
        sendPeerCount(currentRoom);
        if (rooms.get(currentRoom)?.size === 0) rooms.delete(currentRoom);
      }

      currentRoom = roomId;
      if (!rooms.has(roomId)) rooms.set(roomId, new Set());
      rooms.get(roomId).add(ws);

      // Send current state to the newcomer if host exists
      ws.send(JSON.stringify({ type: "joined", roomId }));
      sendPeerCount(roomId);

      // Ask host (first peer) to send current video state to new joiner
      const room = rooms.get(roomId);
      if (room.size > 1) {
        const host = [...room][0];
        if (host !== ws && host.readyState === 1) {
          host.send(JSON.stringify({ type: "state-request" }));
        }
      }
    }

    else if (type === "play" || type === "pause" || type === "seek" || type === "video" || type === "state") {
      // Relay to everyone else in the room
      if (currentRoom) broadcast(currentRoom, msg, ws);
    }

    else if (type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
    }
  });

  ws.on("close", () => {
    if (!currentRoom) return;
    rooms.get(currentRoom)?.delete(ws);
    sendPeerCount(currentRoom);
    if (rooms.get(currentRoom)?.size === 0) rooms.delete(currentRoom);
    currentRoom = null;
  });

  ws.on("error", () => {
    if (currentRoom) {
      rooms.get(currentRoom)?.delete(ws);
      sendPeerCount(currentRoom);
    }
  });
});