<div align="center">

<img src="https://img.shields.io/badge/NeuroStream-AI-e50914?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik04IDVsNyA3LTcgN1oiLz48L3N2Zz4=" alt="NeuroStream AI"/>

# NeuroStream AI

### A production-grade AI-powered desktop video streaming platform

> **The intersection of Netflix, VLC, and an intelligent assistant — built from scratch.**

[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)](https://react.dev)
[![Electron](https://img.shields.io/badge/Electron-30-47848f?style=flat-square&logo=electron)](https://electronjs.org)
[![Express](https://img.shields.io/badge/Express-4-000000?style=flat-square&logo=express)](https://expressjs.com)
[![Vite](https://img.shields.io/badge/Vite-5-646cff?style=flat-square&logo=vite)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Active%20Development-e50914?style=flat-square)]()

[Features](#-features) • [Architecture](#-architecture) • [Getting Started](#-getting-started) • [Screenshots](#-screenshots) • [Roadmap](#-roadmap) • [Contributing](#-contributing)

</div>

---

## 🎯 What Is This?

NeuroStream AI is a **fully-featured desktop video streaming application** built with a modern full-stack architecture. It combines the polish of a commercial streaming platform with the power of a local media player — enhanced by AI-driven voice control, smart metadata extraction, and an intelligent library system.

This project demonstrates end-to-end product engineering: from a custom Electron shell and a streaming Express backend, to a React UI with Zustand state management, real-time subtitle detection, and a voice-controlled assistant.

---

## ✨ Features

### 🎬 Media Playback Engine
- **Chunked HTTP streaming** with range request support — smooth seeking on large files
- Supports **MP4, MKV, AVI, MOV, WebM, M4V, FLV** formats
- Custom-built video player — no browser default controls
- **Adaptive object-fit modes**: Fit (letterbox) / Fill (crop) / Stretch
- Playback speed control (0.25x → 3x)
- Brightness control with real-time filter
- Full keyboard shortcut suite (`Space`, `J/K/L`, `F`, `M`, `S`, `,/.`, `?`)

### 🖥 Desktop Integration (Electron)
- Native **folder picker** — scan entire directories for video files
- Native **file picker** — open individual files
- Custom **frameless window** with branded titlebar and window controls
- **Drag & drop** video files directly onto the app
- `file://` URL streaming for local files without server roundtrip
- Cross-platform: Windows, macOS, Linux

### 🌐 Network & Streaming
- **Paste any direct video URL** to play instantly (MP4 links, CDN streams)
- Built-in sample videos for testing
- Backend proxy to handle CORS-restricted streams
- Express backend with proper `206 Partial Content` streaming

### 🖼 Library & Metadata
- **Real thumbnail generation** via ffprobe/ffmpeg — frame captured at 10% of video
- Lazy thumbnail loading with shimmer skeleton placeholder
- Video metadata extraction: resolution, duration, file size, codec, FPS
- **Quality badges** auto-detected: 4K / 2K / FHD / HD / SD
- Hover-to-preview with muted autoplay on cards
- **Sort by**: Name, Duration, Size, Date Added (ascending/descending)
- **Search** across library with live filtering
- **Remove from library** with confirmation dialog (file on disk untouched)

### ⏱ Watch History & Progress
- Progress bar on every card showing % watched
- Auto-saves playback position every 5 seconds
- Restores position when re-opening a video
- Continue Watching section on Home page
- Full history page with last-watched date and watch count
- Clear individual entries or entire history

### 🎤 Voice Assistant (Jarvis Mode)
- Continuous listening with **Web Speech API** — stays active until you close it
- Live animated **waveform bars** while listening
- Text-to-speech responses via `SpeechSynthesis`
- Full command set:
  - `play`, `pause`, `next`, `back`, `mute`, `fullscreen`
  - `volume up`, `volume down`, `faster`, `slower`
  - `home`, `library`, `history`, `close`
  - `search for [title]`, `play [title]`
- Built-in `?` help panel listing all commands
- Retry button on mic drop

### 📺 Player Controls
- **Custom progress bar** with buffered region indicator
- **Screenshot capture** — saves current frame as PNG (backend ffmpeg or canvas fallback)
- **Subtitle support**: auto-detect `.srt`/`.vtt` next to video file, or load from disk
- **CC panel** with on/off toggle and file loader
- **Settings panel** (⚙ gear icon):
  - Live video info: resolution, native quality, file size, duration
  - Quality selector (144p → 4K) with NATIVE badge
  - Zoom mode toggle
  - Playback speed pills
  - Brightness slider
  - Auto-play next toggle
- **Auto-play next** — plays the next video in library when current ends, with 5-second cancellable banner
- **Mini player** — floating bottom bar when navigating away from Home while video is playing

### 🎯 UX & Navigation
- Netflix-style **4-page sidebar**: Home, Library, Continue Watching, Settings
- Collapsible sidebar with icon-only mode and item count badges
- **Queue system** — right-click → Add to queue, panel shows ordered list
- **Toast notifications** for user actions
- **Keyboard shortcuts overlay** — press `?` anywhere
- **Right-click context menu** on every card: Play, Queue, Copy title, Refresh thumbnail, Show path, Remove
- **Picture-in-Picture** mode via browser API
- Smooth animations throughout: fade-in pages, card lift on hover, scale-in menus
- Full CSS variable theming system

### 🗄 Backend (Express + JSON DB)
- Pure JSON file database — zero native compilation required
- Watch history CRUD with timestamps and watch counts
- Library indexing with persistent metadata
- Subtitle auto-discovery endpoint
- ffprobe metadata extraction endpoint
- Screenshot generation endpoint
- Network URL proxy endpoint

---

## 🏗 Architecture

```
NeuroStream AI/
├── frontend/                    # React + Vite (UI Layer)
│   ├── src/
│   │   ├── components/
│   │   │   ├── VideoPlayer.jsx  # Custom player with all controls
│   │   │   ├── VideoCard.jsx    # Hover preview + context menu + thumbnail
│   │   │   ├── Sidebar.jsx      # Navigation with badges
│   │   │   ├── TitleBar.jsx     # Custom window chrome + search + sort
│   │   │   ├── MiniPlayer.jsx   # Floating persistent player bar
│   │   │   ├── VoiceAssistant.jsx # Jarvis mode
│   │   │   └── NetworkURLPlayer.jsx # URL input modal
│   │   ├── store/
│   │   │   └── useAppStore.js   # Zustand global state + API calls
│   │   ├── App.jsx              # Root layout + all pages
│   │   └── index.css            # CSS variables + animations
│   ├── vite.config.js
│   └── package.json
│
├── backend/                     # Node.js + Express (API Layer)
│   ├── server.js                # All endpoints
│   ├── neurostream-db.json      # Auto-generated JSON database
│   ├── thumbnails/              # Auto-generated thumbnail cache
│   └── package.json
│
├── electron/                    # Electron (Desktop Shell)
│   ├── main.js                  # Window creation + IPC handlers
│   ├── preload.js               # Secure context bridge
│   └── package.json
│
└── media/                       # Default video folder (optional)
```

### Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| UI Framework | React 18 + Vite 5 | Component rendering, hot reload |
| State Management | Zustand + persist | Global state, localStorage sync |
| Desktop Shell | Electron 30 | Native window, file system access |
| Backend | Express 4 | Video streaming, metadata, API |
| Metadata | ffprobe-static | Duration, resolution, codec |
| Thumbnails | fluent-ffmpeg | Frame extraction |
| Database | JSON file (no SQL) | Watch history, library index |
| Voice | Web Speech API | STT + TTS in browser |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ (v22 recommended)
- **npm** v9+
- Windows 10/11, macOS, or Linux

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Unwilling-mcu/NeuroStream-Ai.git
cd NeuroStream-Ai

# 2. Install backend dependencies
cd backend
npm install
cd ..

# 3. Install frontend dependencies
cd frontend
npm install
cd ..

# 4. Install electron dependencies
cd electron
npm install
cd ..
```

### Running the App

Open **3 separate terminals**:

```bash
# Terminal 1 — Start the backend API server
cd backend
npm start
# → Running on http://localhost:5000

# Terminal 2 — Start the frontend dev server
cd frontend
npm run dev
# → Running on http://localhost:5173

# Terminal 3 — Launch the Electron desktop app
cd electron
npm start
# → Desktop window opens
```

> **Note:** Start backend and frontend before launching Electron. The Electron app loads from `http://localhost:5173`.

### Using in Browser (without Electron)

You can also access the app at `http://localhost:5173` in Chrome or Edge. Folder/file picking will be disabled but network URL playback and backend-served videos will work.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` / `K` | Play / Pause |
| `←` / `J` | Rewind 10 seconds |
| `→` / `L` | Forward 10 seconds |
| `↑` / `↓` | Volume up / down |
| `M` | Toggle mute |
| `F` | Toggle fullscreen |
| `S` | Screenshot current frame |
| `,` / `.` | Decrease / Increase speed |
| `Esc` | Close player / Exit fullscreen |
| `?` | Open keyboard shortcuts panel |

---

## 🗺 Roadmap — What's Coming

These features are planned or in active development:

### 🔴 In Progress
- [ ] **HLS / DASH adaptive streaming** — server-side ffmpeg transcoding for true multi-quality output
- [ ] **Auto thumbnail generation on folder scan** — background queue with progress indicator
- [ ] **App icon & taskbar branding** — custom `.ico` / `.icns` for packaged builds
- [ ] **Electron build & installer** — `electron-builder` packaging for distributable `.exe` / `.dmg`

### 🟡 Planned
- [ ] **File association (Windows)** — double-click `.mp4` in Explorer to open in NeuroStream
- [ ] **MKV chapter support** — jump points on the progress bar for chapter-encoded files
- [ ] **Playlist / shuffle mode** — play all videos in folder in order with shuffle toggle
- [ ] **AI-based recommendations** — watch history analysis for "You might like" suggestions
- [ ] **Auto subtitle generation** — Whisper API integration for speech-to-text subtitle creation
- [ ] **Scene detection** — AI-powered highlight clip generation
- [ ] **Multi-user profiles** — separate watch history and preferences per user
- [ ] **Smooth page transitions** — slide/fade animations between sidebar pages
- [ ] **Right-click → Open With** system integration
- [ ] **Cloud sync** — optional watch history sync via REST API or Firebase

### 🟢 Research Phase
- [ ] **Emotion / genre classification** — AI tagging of video content
- [ ] **Content summarization** — AI-generated video descriptions
- [ ] **Plugin system** — extensible feature modules
- [ ] **Mobile companion app** — React Native remote control
- [ ] **WebRTC co-watching** — synchronized playback with friends

---

## 🤝 Contributing

Contributions, issues and feature requests are welcome.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 👨‍💻 Author

**Sanchayan** — [@Unwilling-mcu](https://github.com/Unwilling-mcu)

> *Built as a showcase of full-stack desktop application engineering, combining modern web technologies with native desktop capabilities and AI-powered features.*

---

<div align="center">

⭐ **If you found this project interesting, please star it — it helps others discover it!** ⭐

</div>
