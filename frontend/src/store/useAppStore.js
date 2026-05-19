import { create } from "zustand";
import { persist } from "zustand/middleware";

const API = "http://localhost:5000/api";

// ── Helper: scan a folder path and return videos + audios ──────────
// Used both by openFolder (after dialog) and restoreLastFolder (on startup)
async function scanFolderPath(folderPath) {
  if (!window.electronAPI) return null;
  // Use the new scanFolder IPC that doesn't show a dialog
  const result = await window.electronAPI.scanFolder(folderPath);
  return result; // { videos, audios } or { error }
}

// ── Helper: enrich files with backend metadata ─────────────────────
async function enrichWithBackend(folderPath, videos, audios) {
  try {
    const res = await fetch(
      `${API}/scan?folder=${encodeURIComponent(folderPath)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) throw new Error("Backend scan failed");
    const backendList = await res.json();

    const enriched = videos.map(ev => {
      const meta = backendList.find(b => b.filename === ev.filename);
      if (!meta) return ev;
      return {
        ...ev,
        duration:   meta.duration   || ev.duration   || 0,
        size:       meta.size       || ev.size       || 0,
        resolution: meta.resolution || ev.resolution || "Unknown",
        thumbnail:  meta.thumbnail  || ev.thumbnail  || null,
        fps:        meta.fps        || null,
        codec:      meta.codec      || null,
      };
    });

    const enrichedAudio = audios.map(ea => {
      const meta = backendList.find(b => b.filename === ea.filename);
      if (!meta) return ea;
      return {
        ...ea,
        duration: meta.duration || ea.duration || 0,
        size:     meta.size     || ea.size     || 0,
      };
    });

    return { enriched, enrichedAudio };
  } catch (e) {
    console.warn("Backend enrichment skipped:", e.message);
    return null; // Not fatal — files still play without metadata
  }
}

export const useAppStore = create(
  persist(
    (set, get) => ({
      // ── State ──────────────────────────────────────────────────
      videos: [],
      audios: [],
      currentVideo: null,
      currentAudio: null,
      history: [],
      searchQuery: "",
      searchResults: [],
      currentPage: "home",
      folderPath: null,
      isLoading: false,
      isRestoring: false,   // true while auto-restoring last folder on startup
      sidebarCollapsed: false,
      volume: 1,
      isMuted: false,
      voiceActive: false,

      // ── YouTube Music persistent player state ──────────────────
      ytTrack:     null,
      ytStreamUrl: null,
      ytPlaying:   false,
      ytQueue:     [],
      ytQueueIdx:  -1,

      setYtTrack:     (t)    => set({ ytTrack: t }),
      setYtStreamUrl: (url)  => set({ ytStreamUrl: url }),
      setYtPlaying:   (v)    => set({ ytPlaying: v }),
      setYtQueue:     (q, i) => set({ ytQueue: q, ytQueueIdx: i }),
      setYtQueueIdx:  (i)    => set({ ytQueueIdx: i }),


      // ── Watch Together persistent state ────────────────────────
      wtRoomId:    null,
      wtJoined:    false,
      wtPeers:     0,
      wtIsHost:    false,
      wtRoomVideo: null,
      wtLog:       [],
      wtStatus:    "idle",

      setWtRoomId:    (v) => set({ wtRoomId: v }),
      setWtJoined:    (v) => set({ wtJoined: v }),
      setWtPeers:     (v) => set({ wtPeers: v }),
      setWtIsHost:    (v) => set({ wtIsHost: v }),
      setWtRoomVideo: (v) => set({ wtRoomVideo: v }),
      setWtStatus:    (v) => set({ wtStatus: v }),
      addWtLog:    (msg) => set(s => ({ wtLog: [...s.wtLog.slice(-8), msg] })),
      resetWt:     ()    => set({ wtRoomId: null, wtJoined: false, wtPeers: 0, wtIsHost: false, wtRoomVideo: null, wtLog: [], wtStatus: "idle" }),


      // ── Setters ────────────────────────────────────────────────
      setPage:             (page) => set({ currentPage: page }),
      setCurrentVideo:     (v)    => set({ currentVideo: v }),
      setCurrentAudio:     (a)    => set({ currentAudio: a }),
      setVideos:           (v)    => set({ videos: v }),
      setAudios:           (a)    => set({ audios: a }),
      setSidebarCollapsed: (v)    => set({ sidebarCollapsed: v }),
      setVolume:           (v)    => set({ volume: v }),
      setMuted:            (v)    => set({ isMuted: v }),
      setVoiceActive:      (v)    => set({ voiceActive: v }),

      // ── Restore last folder on app startup ──────────────────────
      // Called once in App.jsx useEffect on mount.
      // Silently reloads the last folder without showing any dialog.
      restoreLastFolder: async () => {
        const { folderPath } = get();
        if (!folderPath || !window.electronAPI) return;

        set({ isRestoring: true });
        try {
          const result = await window.electronAPI.scanFolder(folderPath);

          if (!result || result.error) {
            // Folder was moved or deleted — clear saved path
            console.warn("Last folder not accessible, clearing saved path.");
            set({ folderPath: null, isRestoring: false });
            return;
          }

          const { videos = [], audios = [] } = result;

          // Show files immediately
          set({ videos, audios, isRestoring: false });

          // Enrich with metadata in background (non-blocking)
          enrichWithBackend(folderPath, videos, audios).then(res => {
            if (res) set({ videos: res.enriched, audios: res.enrichedAudio });
          });

        } catch (e) {
          console.error("restoreLastFolder error:", e);
          set({ isRestoring: false });
        }
      },

      // ── Open folder (user picks via dialog) ─────────────────────
      openFolder: async () => {
        set({ isLoading: true });
        try {
          if (window.electronAPI) {
            const result = await window.electronAPI.selectFolder();
            if (!result || result.canceled) {
              set({ isLoading: false });
              return;
            }

            const { folderPath, videos = [], audios = [] } = result;

            // Show files immediately
            set({ videos, audios, folderPath, isLoading: false });

            // Enrich with backend metadata in background
            enrichWithBackend(folderPath, videos, audios).then(res => {
              if (res) set({ videos: res.enriched, audios: res.enrichedAudio });
            });

          } else {
            // Browser mode
            const res = await fetch(`${API}/videos`);
            const data = await res.json();
            set({ videos: data, isLoading: false });
          }
        } catch (e) {
          console.error("openFolder error:", e);
          set({ isLoading: false });
        }
      },

      // ── Open single file ───────────────────────────────────────
      openFile: async () => {
        if (!window.electronAPI) return;
        const file = await window.electronAPI.selectFile();
        if (!file) return;

        const newItem = {
          ...file,
          id: Date.now(),
          url: file.url || `file://${(file.file_path || "").replace(/\\/g, "/")}`,
        };

        if (file.isAudio) {
          set(state => ({
            audios: [...state.audios, newItem],
            currentAudio: newItem,
          }));
        } else {
          set(state => ({
            videos: state.videos.find(v => v.file_path === newItem.file_path)
              ? state.videos
              : [...state.videos, newItem],
            currentVideo: newItem,
          }));
        }

        if (file.folder_path) {
          fetch(`${API}/scan?folder=${encodeURIComponent(file.folder_path)}`).catch(() => {});
        }
      },

      // ── History ────────────────────────────────────────────────
      loadHistory: async () => {
        try {
          const res = await fetch(`${API}/history`);
          if (!res.ok) throw new Error("history fetch failed");
          const data = await res.json();
          set({ history: Array.isArray(data) ? data : [] });
        } catch {
          set({ history: [] });
        }
      },

      saveProgress: async (video, progress, duration) => {
        if (!video || !progress || isNaN(progress)) return;
        const persistPath = video.file_path && !video.file_path.startsWith("blob:")
          ? video.file_path
          : video.url && !video.url.startsWith("blob:") ? video.url : null;
        if (!persistPath) return;
        try {
          await fetch(`${API}/history`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: video.title,
              file_path: persistPath,
              progress: Math.floor(progress),
              duration: Math.floor(duration || 0),
            }),
          });
          set(state => {
            const idx = state.history.findIndex(h => h.file_path === persistPath);
            if (idx >= 0) {
              const updated = [...state.history];
              updated[idx] = { ...updated[idx], progress: Math.floor(progress), duration: Math.floor(duration || 0) };
              return { history: updated };
            }
            return {};
          });
        } catch {}
      },

      // ── Remove from library ────────────────────────────────────
      removeVideo: async (video) => {
        set(state => ({
          videos: state.videos.filter(v => v.id !== video.id && v.file_path !== video.file_path),
          currentVideo: state.currentVideo?.id === video.id ? null : state.currentVideo,
          searchResults: state.searchResults.filter(v => v.id !== video.id),
        }));
        try {
          await fetch(`${API}/library`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file_path: video.file_path || video.url }),
          });
        } catch {}
      },

      removeAudio: async (audio) => {
        set(state => ({
          audios: state.audios.filter(a => a.id !== audio.id),
          currentAudio: state.currentAudio?.id === audio.id ? null : state.currentAudio,
        }));
      },

      // ── Search ─────────────────────────────────────────────────
      search: async (q) => {
        set({ searchQuery: q });
        if (!q.trim()) { set({ searchResults: [] }); return; }
        try {
          const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}`);
          if (res.ok) {
            const data = await res.json();
            set({ searchResults: Array.isArray(data) ? data : [] });
            return;
          }
        } catch {}
        const all = [...get().videos, ...get().audios];
        set({ searchResults: all.filter(v => v.title.toLowerCase().includes(q.toLowerCase())) });
      },
    }),
    {
      name: "neurostream-store",
      partialize: (state) => ({
        volume:           state.volume,
        isMuted:          state.isMuted,
        sidebarCollapsed: state.sidebarCollapsed,
        folderPath:       state.folderPath,  // ← persisted so we can restore on next launch
      }),
    }
  )
);