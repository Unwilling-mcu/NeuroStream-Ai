import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync, execSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

// ─── Thumbnail cache dir ───────────────────────────────────────────
const THUMB_DIR = path.join(__dirname, "thumbnails");
if (!fs.existsSync(THUMB_DIR)) fs.mkdirSync(THUMB_DIR, { recursive: true });

// ─── Pure JSON DB ──────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, "neurostream-db.json");
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
  const mod = await import("ffprobe-static");
  ffprobeExec = mod.default?.path ?? mod.path ?? null;
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

// ─── Scan folder ───────────────────────────────────────────────────
const SUPPORTED = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v", ".flv"];

function scanFolder(folderPath) {
  try {
    return fs.readdirSync(folderPath, { withFileTypes: true })
      .filter(f => f.isFile() && SUPPORTED.includes(path.extname(f.name).toLowerCase()))
      .map((f, i) => {
        const filePath = path.join(folderPath, f.name);
        const meta = getVideoMetadata(filePath);
        const thumbPath = getThumbnailPath(filePath);
        const hasCachedThumb = fs.existsSync(thumbPath);
        return {
          id: i,
          title: path.basename(f.name, path.extname(f.name)),
          filename: f.name,
          file_path: filePath,
          folder_path: folderPath,
          url: `http://localhost:5000/api/stream/${encodeURIComponent(f.name)}?folder=${encodeURIComponent(folderPath)}`,
          thumbnail: hasCachedThumb
            ? `http://localhost:5000/api/thumbnail/${encodeURIComponent(path.basename(thumbPath))}`
            : null,
          ...meta,
        };
      });
  } catch (e) { console.error("Scan error:", e.message); return []; }
}

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

  // Send response immediately, generate thumbnails in background
  res.json(videos);

  // Background thumbnail generation
  for (const v of videos) {
    const thumbPath = getThumbnailPath(v.file_path);
    if (!fs.existsSync(thumbPath)) {
      generateThumbnail(v.file_path, thumbPath).catch(() => {});
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
    const fetch = (await import("node-fetch")).default;
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

app.listen(5000, () => {
  console.log("🚀 NeuroStream backend → http://localhost:5000");
  console.log(`📁 Thumbnails → ${THUMB_DIR}`);
});