# NeuroStream AI 🎬

> A feature-rich desktop media player built with **React + Vite + Electron** — play local videos and audio, stream YouTube Music for free, watch together with friends in sync with live chat, and control everything with your voice.

![Version](https://img.shields.io/badge/version-3.2.0-red)
![Electron](https://img.shields.io/badge/electron-30-blue)
![React](https://img.shields.io/badge/react-18-61dafb)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

### 🎬 Video Player
- Play **MP4, MKV, AVI, MOV, WebM, M4V, FLV** and more
- Open a folder, single file, drag & drop, or paste a Network URL
- Auto-restore last opened folder on startup
- Video thumbnail preview on card hover
- Progress tracking — resume where you left off (Continue Watching)
- Bookmarks with custom timestamps
- Picture-in-Picture mode
- Screenshot capture at any frame
- Chapter support (MKV + MP4)
- Subtitle support (`.vtt`, `.srt`)
- **4K / FHD / HD / SD** quality badges
- Right-click context menu (Play now, Add to queue, Copy title, Show file path)
- Full keyboard shortcut support

### 🎵 Audio Player
- Play **MP3, FLAC, WAV, AAC, OGG, M4A, WMA, OPUS**
- Auto-extracted album art and ID3 metadata
- Audio visualizer
- 10-band Equalizer with presets
- Loop modes (one / all / none)
- Crossfade between tracks
- Lyrics panel
- OS notifications on track change

### ▶ YouTube Music (Free · No Login · No API Key)
- Search any song, artist, or album
- Trending music loaded automatically on open
- **Playlists** — create, rename, reorder, delete — saved permanently in localStorage
- Add any track to a playlist via ➕ hover button
- **Play All** to queue an entire playlist into the mini player
- Streams audio via `yt-dlp` — no download, plays immediately
- **Network URL** tab — paste any MP4, M3U8, or WEBM stream URL to play it
- **Watch Together integration** — 👥 button streams any track directly to your room
- Music keeps playing when you navigate between pages

### 👥 Watch Together
- Create a room with a 6-char Room ID — share it with anyone
- **Live video sync** — host picks a video, all viewers load it automatically
- Each viewer can independently pause/scrub at their own pace
- **💬 Live chat** — iMessage-style chat panel alongside the video
- **👤 Nicknames** — set your display name once, shown in chat and viewer list
- **Viewer list** — see everyone connected with live join/leave alerts
- **Host controls:**
  - 📂 Open any local file and stream to all viewers
  - 🌐 Paste a Network URL (MP4, M3U8, HLS stream) and stream to all viewers
  - Pick from loaded library in the sidebar
  - Stream any YouTube Music track to the room with one click
- Room stays connected when navigating between all pages
- Works across browser tabs on the same machine or local network

### 🎤 Voice Assistant
- Hands-free control via voice commands

### ⚙️ General
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
├── backend/
│   ├── server.js               # Express API + WebSocket server (port 5000)
│   ├── package.json            # CJS — no "type": "module"
│   ├── thumbnails/             # Auto-generated video thumbnails
│   ├── album-art/              # Extracted album art
│   └── neurostream-db.json     # Watch history + library (dev only)
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Root — routing, persistent players, Watch Together UI
│   │   ├── components/
│   │   │   ├── VideoPlayer.jsx
│   │   │   ├── VideoCard.jsx
│   │   │   ├── YoutubePage.jsx           # YT Music + playlists + Network URL
│   │   │   ├── YoutubeMiniPlayer.jsx     # Persistent audio bar (never unmounts)
│   │   │   ├── WatchTogetherManager.jsx  # Persistent WebSocket manager (never unmounts)
│   │   │   ├── Sidebar.jsx
│   │   │   ├── AudioVisualizer.jsx
│   │   │   ├── Equalizer.jsx
│   │   │   ├── MiniPlayer.jsx
│   │   │   ├── SleepTimer.jsx
│   │   │   ├── VoiceAssistant.jsx
│   │   │   ├── VideoBookmarks.jsx
│   │   │   └── NetworkURLPlayer.jsx
│   │   └── store/
│   │       └── useAppStore.js            # Zustand global state (video, audio, YT, WT)
│   ├── vite.config.js          # base: "./" required for Electron production build
│   └── package.json
│
└── electron/
    ├── main.js                 # Window, IPC, auto-start backend, Spotify PKCE intercept
    ├── preload.js
    ├── splash.html
    ├── assets/
    │   ├── icon.ico
    │   └── yt-dlp.exe          # Bundled binary for production
    └── package.json            # electron-builder config with extraResources
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Python | 3.8+ | [python.org](https://python.org) |
| yt-dlp | latest | `pip install yt-dlp` |

### Install dependencies

```bash
cd backend  && npm install
cd ../frontend && npm install
cd ../electron && npm install
```

### Run in development

Open **3 terminals**:

```bash
# Terminal 1 — Backend (Express + WebSocket)
cd backend && node server.js

# Terminal 2 — Frontend (Vite hot reload)
cd frontend && npm run dev

# Terminal 3 — Electron
cd electron && npm start
```

---

## 📦 Build for Production

### Step 1 — Get yt-dlp binary (Windows)
```powershell
New-Item -ItemType Directory -Force -Path electron\assets
Invoke-WebRequest -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile "electron\assets\yt-dlp.exe"
```

### Step 2 — Build
```powershell
cd frontend  && npm run build
cd ..\backend && npm install --omit=dev
cd ..\electron && npm run build:win
```

| Platform | Command | Output |
|----------|---------|--------|
| Windows | `npm run build:win` | `.exe` NSIS installer |
| macOS | `npm run build:mac` | `.dmg` disk image |
| Linux | `npm run build:linux` | `.AppImage` |

Output goes to `electron/dist-build/`.

---

## 👥 Watch Together — Usage

```
Tab 1 (Host)                          Tab 2 (Viewer)
────────────────────────────────      ────────────────────────
1. Watch Together → Create Room   →   1. Watch Together → paste Room ID
2. Share "JZ1D0V" with friend     →   2. Click Join
3. Pick a video (file/URL/YT)     →   3. Video loads automatically
4. Chat in the panel              ↔   4. Chat back
```

Works between:
- Two browser tabs on the same machine (`localhost:5173`)
- Electron app + Chrome browser on the same machine
- Two devices on the same local network (use your LAN IP instead of localhost)

---

## 🌐 Backend API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server status |
| `/api/scan` | GET | Scan folder for media |
| `/api/stream/:filename` | GET | Stream video (range support) |
| `/api/stream-file?path=` | GET | Stream by full path (Watch Together) |
| `/api/thumbnail-generate` | GET | Generate thumbnail via ffmpeg |
| `/api/album-art-generate` | GET | Extract album art |
| `/api/history` | GET/POST/DELETE | Watch history |
| `/api/library` | GET/DELETE | Library |
| `/api/chapters` | GET | Chapter markers |
| `/api/subtitle/:filename` | GET | Serve subtitle |
| `/api/screenshot` | GET | Frame capture |
| `/api/yt/search` | GET | Search YouTube |
| `/api/yt/trending` | GET | Trending music |
| `/api/yt/stream-url` | GET | Direct audio URL |
| `ws://localhost:5000` | WebSocket | Watch Together sync + chat |

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
| `B` | Bookmark |
| `A` | Play / Pause audio |
| `N` | Next audio track |
| `Esc` | Close overlay |
| `?` | Show shortcuts |

---

## 🐛 Known Limitations

- YouTube Music and Watch Together YT streaming require **yt-dlp** — `pip install yt-dlp`
- Spotify integration requires **Spotify Premium** — disabled by default
- Watch Together across the internet requires port forwarding or a hosted backend
- No voice/mic in Watch Together — use Discord alongside NeuroStream
- Packaged app requires **Node.js** installed on the user's machine

---

## 🔄 Changelog

### v3.2.0 — Social Update
- YouTube Music playlists (create / rename / reorder / delete, localStorage)
- Watch Together live chat with iMessage-style bubbles
- Nicknames with localStorage persistence + viewer list
- Network URL streaming inside Watch Together theatre
- YouTube Music tracks streamable directly to Watch Together room

### v3.1.0 — Watch Together Rebuild
- Full theatre mode with embedded player
- Persistent WebSocket across page navigation
- Host/Viewer roles, file picker, library sidebar

### v3.0.0 — Initial Release
- Local video + audio player
- YouTube Music via yt-dlp (free, no login)
- Voice assistant, 5 themes, equalizer, sleep timer

---

## 📄 License

MIT © 2026 Sanchayan