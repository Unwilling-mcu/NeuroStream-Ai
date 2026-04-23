import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

// ─── Pure JSON DB (no native compilation needed) ───────────────────
const DB_PATH = path.join(__dirname, "neurostream-db.json");

function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify({ history: [], library: [] }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  } catch {
    return { history: [], library: [] };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("DB write error:", e.message);
  }
}

// ─── ffprobe (for video metadata) ──────────────────────────────────
let ffprobeExec = null;
try {
  // Dynamic import works with ESM
  const mod = await import("ffprobe-static");
  ffprobeExec = mod.default?.path ?? mod.path ?? null;
  if (ffprobeExec) console.log("✅ ffprobe found:", ffprobeExec);
} catch {
  console.warn("⚠️  ffprobe-static not available — metadata will show as 0/Unknown");
}

function getVideoMetadata(filePath) {
  if (!ffprobeExec) return { duration: 0, size: 0, resolution: "Unknown" };
  try {
    const output = execFileSync(ffprobeExec, [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      filePath
    ], { timeout: 8000 });

    const data = JSON.parse(output.toString());
    const vs = data.streams?.find(s => s.codec_type === "video");
    return {
      duration: parseFloat(data.format?.duration || 0),
      size: parseInt(data.format?.size || 0),
      resolution: vs?.width && vs?.height ? `${vs.width}x${vs.height}` : "Unknown"
    };
  } catch {
    return { duration: 0, size: 0, resolution: "Unknown" };
  }
}

function scanFolder(folderPath) {
  const SUPPORTED = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v", ".flv"];
  try {
    return fs.readdirSync(folderPath, { withFileTypes: true })
      .filter(f => f.isFile() && SUPPORTED.includes(path.extname(f.name).toLowerCase()))
      .map((f, i) => {
        const filePath = path.join(folderPath, f.name);
        const meta = getVideoMetadata(filePath);
        return {
          id: i,
          title: path.basename(f.name, path.extname(f.name)),
          filename: f.name,
          file_path: filePath,
          folder_path: folderPath,
          url: `http://localhost:5000/api/stream/${encodeURIComponent(f.name)}?folder=${encodeURIComponent(folderPath)}`,
          ...meta
        };
      });
  } catch (e) {
    console.error("Scan error:", e.message);
    return [];
  }
}

// ─── Routes ───────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => res.json({ status: "ok", version: "2.0.1" }));

// Default media folder
app.get("/api/videos", (_req, res) => {
  const dir = path.join(process.cwd(), "../media");
  if (!fs.existsSync(dir)) return res.json([]);
  res.json(scanFolder(dir));
});

// Scan any folder path
app.get("/api/scan", (req, res) => {
  const { folder } = req.query;
  if (!folder || !fs.existsSync(folder)) {
    return res.status(400).json({ error: "Invalid folder path" });
  }
  const videos = scanFolder(folder);

  // Index into JSON library
  const db = readDB();
  for (const v of videos) {
    if (!db.library.find(l => l.file_path === v.file_path)) {
      db.library.push({ ...v, added_at: Date.now() });
    }
  }
  writeDB(db);

  res.json(videos);
});

// ─── Chunked video streaming ───────────────────────────────────────
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

  const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
  const start = parseInt(startStr, 10);
  const end = endStr ? parseInt(endStr, 10) : stat.size - 1;

  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${stat.size}`,
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1,
    "Content-Type": contentType,
  });
  fs.createReadStream(filePath, { start, end }).pipe(res);
});

// ─── Subtitles ────────────────────────────────────────────────────
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

// ─── Watch History ─────────────────────────────────────────────────
app.get("/api/history", (_req, res) => {
  const db = readDB();
  res.json([...db.history].sort((a, b) => b.last_watched - a.last_watched).slice(0, 50));
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

// ─── Library & Search ─────────────────────────────────────────────
app.get("/api/library", (_req, res) => {
  const db = readDB();
  res.json([...db.library].sort((a, b) => b.added_at - a.added_at));
});

app.get("/api/search", (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  const db = readDB();
  res.json(db.library.filter(v => v.title.toLowerCase().includes(q)).slice(0, 50));
});

app.listen(5000, () => console.log("🚀 NeuroStream backend → http://localhost:5000"));