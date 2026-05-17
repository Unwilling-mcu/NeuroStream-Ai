# NeuroStream AI 🎬

> A feature-rich desktop media player built with **React + Vite + Electron** — play local videos and audio, stream YouTube Music for free, watch together with friends, and control everything with your voice.

![Version](https://img.shields.io/badge/version-3.0.0-red) ![Electron](https://img.shields.io/badge/electron-30-blue) ![React](https://img.shields.io/badge/react-18-61dafb) ![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

### 🎬 Video Player
- Play **MP4, MKV, AVI, MOV, WebM, M4V, FLV** and more
- Open a folder, a single file, drag & drop, or paste a network URL
- Auto-restore last opened folder on startup
- Video preview on card hover
- Progress tracking with percentage — resume where you left off
- Bookmarks with timestamps
- Picture-in-Picture mode
- Screenshot capture
- Keyboard shortcuts (`Space`, `F`, `M`, `S`, `B`, `←/→`, `↑/↓`)
- Chapters support (MKV + MP4)
- Subtitle support (`.vtt`, `.srt`)
- **4K / FHD / HD / SD** quality badges

### 🎵 Audio Player
- Play **MP3, FLAC, WAV, AAC, OGG, M4A, WMA**
- Auto-extracted album art and metadata
- Audio visualizer
- 10-band Equalizer with presets
- Loop modes (one / all / none)
- Crossfade between tracks
- Lyrics panel
- OS notifications on track change

### ▶ YouTube Music (Free, No Login)
- Search any song, artist, or album
- Trending music loaded automatically
- One-click play via `yt-dlp` — streams audio directly, no download
- Persists across page navigation (keeps playing when you switch pages)
- Auto-advances through the full result list as a queue

### 👥 Watch Together
- Create or join a room with a 6-character Room ID
- Syncs play, pause, and seek across browser tabs on the same machine
- WebSocket-ready architecture for multi-device sync

### 🎤 Voice Assistant
- Hands-free control — say commands to play, pause, skip, search

### ⚙️ Other
- 5 themes: Dark, AMOLED Black, Navy Blue, Forest Green, Midnight Purple
- Sleep timer
- Export watch history as CSV
- Recent files panel
- Video notes
- Mini player when switching pages
- Queue management

---

## 🗂 Project Structure

```
NeuroStream AI/
├── backend/          # Express.js API server (port 5000)
│   ├── server.js     # Media scan, metadata, thumbnails, history, YouTube routes
│   └── package.json
├── frontend/         # React + Vite UI
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── VideoPlayer.jsx
│   │   │   ├── VideoCard.jsx
│   │   │   ├── YoutubePage.jsx       # YouTube Music browse UI
│   │   │   ├── YoutubeMiniPlayer.jsx # Persistent audio bar (never unmounts)
│   │   │   ├── Sidebar.jsx
│   │   │   ├── AudioVisualizer.jsx
│   │   │   ├── Equalizer.jsx
│   │   │   ├── MiniPlayer.jsx
│   │   │   ├── SleepTimer.jsx
│   │   │   ├── VoiceAssistant.jsx
│   │   │   └── ...
│   │   └── store/
│   │       └── useAppStore.js        # Zustand global state
│   └── package.json
└── electron/         # Electron shell
    ├── main.js       # Window management, IPC, Spotify callback intercept
    ├── preload.js
    └── package.json
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Python | 3.8+ | [python.org](https://python.org) |
| yt-dlp | latest | `pip install yt-dlp` |
| ffmpeg | any | [ffmpeg.org](https://ffmpeg.org) or bundled via `ffprobe-static` |

### Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# Electron
cd ../electron
npm install
```

### Run in development

Open **3 terminals**:

```bash
# Terminal 1 — Backend API
cd backend
node server.js
# → http://localhost:5000

# Terminal 2 — Frontend (Vite dev server)
cd frontend
npm run dev
# → http://localhost:5173

# Terminal 3 — Electron
cd electron
npm start
```

---

## 📦 Build for Production

```bash
# 1. Build the frontend
cd frontend
npm run build

# 2. Package into an installer
cd ../electron
npm run build:win      # Windows → dist-build/*.exe
npm run build:mac      # macOS   → dist-build/*.dmg
npm run build:linux    # Linux   → dist-build/*.AppImage
```

Output is in `electron/dist-build/`.

---

## 🎵 YouTube Music Setup

YouTube Music works out of the box — no account or API key needed.

Just make sure `yt-dlp` is installed and on your PATH:

```bash
pip install yt-dlp

# Verify
yt-dlp --version
```

> **How it works:** The backend runs `yt-dlp --get-url` to fetch a direct CDN audio URL from YouTube. The `<audio>` element in the app plays it natively — no download, no DRM issues.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` / `K` | Play / Pause video |
| `←` / `J` | Rewind 10s |
| `→` / `L` | Forward 10s |
| `↑` / `↓` | Volume up / down |
| `M` | Mute |
| `F` | Fullscreen |
| `S` | Screenshot |
| `B` | Add bookmark |
| `A` | Play / Pause audio |
| `N` | Next audio track |
| `?` | Show shortcuts panel |
| `Esc` | Close overlay |

---

## 🔧 Backend API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scan` | GET | Scan folder, return video/audio metadata |
| `/api/thumbnail-generate` | GET | Generate video thumbnail via ffmpeg |
| `/api/album-art-generate` | GET | Extract album art from audio file |
| `/api/history` | GET/POST/DELETE | Watch history CRUD |
| `/api/library` | GET/DELETE | Library management |
| `/api/chapters` | GET | Extract chapter markers from video |
| `/api/subtitle/:filename` | GET | Serve subtitle file |
| `/api/yt/search` | GET | Search YouTube via yt-dlp |
| `/api/yt/trending` | GET | Fetch trending music playlist |
| `/api/yt/stream-url` | GET | Get direct audio stream URL for a video ID |

---

## 🐛 Known Limitations

- **YouTube Music requires yt-dlp** to be installed — install with `pip install yt-dlp`
- **Spotify integration requires Spotify Premium** — the free tier blocks the Web API
- **Watch Together** syncs across tabs on the same device; real multi-device sync requires a WebSocket server
- **Video preview on hover** only works for local files, not network streams

---

## 📄 License

MIT © 2026 Riju