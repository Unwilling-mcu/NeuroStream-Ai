import { create } from "zustand";
import { persist } from "zustand/middleware";

const API = "http://localhost:5000/api";

export const useAppStore = create(
  persist(
    (set, get) => ({
      // ── State ──────────────────────────────────────────────────
      videos: [],
      currentVideo: null,
      history: [],
      searchQuery: "",
      searchResults: [],
      currentPage: "home",
      folderPath: null,
      isLoading: false,
      sidebarCollapsed: false,
      playerVisible: false,
      volume: 1,
      isMuted: false,
      voiceActive: false,
      theme: "dark",          // dark | darker | cinema
      autoPlayNext: true,
      queue: [],
      thumbnailsLoading: false,

      // ── Setters ────────────────────────────────────────────────
      setPage: (page) => set({ currentPage: page }),
      setCurrentVideo: (video) => set({ currentVideo: video, playerVisible: !!video }),
      setVideos: (videos) => set({ videos }),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setVolume: (v) => set({ volume: v }),
      setMuted: (v) => set({ isMuted: v }),
      setVoiceActive: (v) => set({ voiceActive: v }),
      setTheme: (t) => set({ theme: t }),
      setAutoPlayNext: (v) => set({ autoPlayNext: v }),
      setQueue: (q) => set({ queue: q }),

      // ── Auto-play next ─────────────────────────────────────────
      playNext: () => {
        const { videos, currentVideo, queue, setCurrentVideo, setQueue } = get();

        // Play from queue first
        if (queue.length > 0) {
          setCurrentVideo(queue[0]);
          setQueue(queue.slice(1));
          return true;
        }

        // Play next in library
        if (!currentVideo || videos.length === 0) return false;
        const idx = videos.findIndex(v => v.id === currentVideo.id || v.file_path === currentVideo.file_path);
        if (idx >= 0 && idx < videos.length - 1) {
          setCurrentVideo(videos[idx + 1]);
          return true;
        }
        return false;
      },

      playPrev: () => {
        const { videos, currentVideo, setCurrentVideo } = get();
        if (!currentVideo || videos.length === 0) return false;
        const idx = videos.findIndex(v => v.id === currentVideo.id || v.file_path === currentVideo.file_path);
        if (idx > 0) { setCurrentVideo(videos[idx - 1]); return true; }
        return false;
      },

      // ── Open folder ────────────────────────────────────────────
      openFolder: async () => {
        set({ isLoading: true });
        try {
          if (window.electronAPI) {
            const result = await window.electronAPI.selectFolder();
            if (result.canceled) return;

            const res = await fetch(`${API}/scan?folder=${encodeURIComponent(result.folderPath)}`);
            const backendVideos = await res.json();

            const merged = result.videos.map(ev => {
              const meta = backendVideos.find(bv => bv.filename === ev.filename) || {};
              return { ...ev, ...meta, url: ev.url };
            });

            set({ videos: merged, folderPath: result.folderPath });

            // Poll for thumbnails every 3s for 30s after scan
            get().pollThumbnails(result.folderPath, result.videos.map(v => v.filename));
          } else {
            const res = await fetch(`${API}/videos`);
            const data = await res.json();
            set({ videos: data });
          }
        } catch (e) {
          console.error("openFolder:", e);
        } finally {
          set({ isLoading: false });
        }
      },

      // Poll backend for thumbnails after scan (they generate in background)
      pollThumbnails: (folderPath, filenames) => {
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          if (attempts > 10) { clearInterval(interval); return; }
          try {
            const res = await fetch(`${API}/scan?folder=${encodeURIComponent(folderPath)}`);
            const updated = await res.json();
            set(state => ({
              videos: state.videos.map(v => {
                const fresh = updated.find(u => u.filename === v.filename);
                return fresh?.thumbnail ? { ...v, thumbnail: fresh.thumbnail } : v;
              })
            }));
          } catch {}
        }, 3000);
      },

      // ── Open single file ───────────────────────────────────────
      openFile: async () => {
        if (!window.electronAPI) return;
        const file = await window.electronAPI.selectFile();
        if (!file) return;
        const newVideo = { ...file, id: Date.now() };
        set(state => ({
          videos: [...state.videos, newVideo],
          currentVideo: newVideo,
          playerVisible: true,
        }));
      },

      // ── Network URL playback ───────────────────────────────────
      openURL: (url, title) => {
        if (!url) return;
        const video = {
          id: Date.now(),
          title: title || url.split("/").pop() || "Network Stream",
          filename: url.split("/").pop() || "stream",
          url,
          file_path: url,
          isNetwork: true,
          duration: 0, size: 0, resolution: "Unknown",
        };
        set(state => ({
          videos: state.videos.find(v => v.url === url) ? state.videos : [...state.videos, video],
          currentVideo: video,
          playerVisible: true,
        }));
      },

      // ── Watch History ──────────────────────────────────────────
      loadHistory: async () => {
        try {
          const res = await fetch(`${API}/history`);
          set({ history: await res.json() });
        } catch {}
      },

      saveProgress: async (video, progress, duration) => {
        if (!video || video.isNetwork) return;
        try {
          await fetch(`${API}/history`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: video.title,
              file_path: video.file_path || video.url,
              progress, duration,
            }),
          });
          // Update local history too
          set(state => {
            const idx = state.history.findIndex(h => h.file_path === (video.file_path || video.url));
            if (idx >= 0) {
              const updated = [...state.history];
              updated[idx] = { ...updated[idx], progress, duration };
              return { history: updated };
            }
            return {};
          });
        } catch {}
      },

      // ── Remove video from library ──────────────────────────────
      removeVideo: async (video) => {
        // Remove from local state immediately
        set(state => ({
          videos: state.videos.filter(v => v.id !== video.id && v.file_path !== video.file_path),
          currentVideo: state.currentVideo?.id === video.id ? null : state.currentVideo,
          searchResults: state.searchResults.filter(v => v.id !== video.id),
        }));

        // Remove from backend DB library
        try {
          await fetch(`${API}/library`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file_path: video.file_path || video.url }),
          });
        } catch (e) {
          console.warn("Library remove API error:", e.message);
        }

        // Also remove from watch history
        try {
          const db_res = await fetch(`${API}/history`);
          const history = await db_res.json();
          const match = history.find(h => h.file_path === (video.file_path || video.url));
          if (match) {
            await fetch(`${API}/history/${match.id}`, { method: "DELETE" });
          }
        } catch {}
      },

      // ── Search ─────────────────────────────────────────────────
      search: async (q) => {
        set({ searchQuery: q });
        if (!q.trim()) { set({ searchResults: [] }); return; }
        try {
          const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          set({ searchResults: data });
        } catch {
          const filtered = get().videos.filter(v =>
            v.title.toLowerCase().includes(q.toLowerCase())
          );
          set({ searchResults: filtered });
        }
      },

      // ── Screenshot ─────────────────────────────────────────────
      takeScreenshot: async (video, timestamp) => {
        if (!video?.file_path || video.isNetwork) return null;
        try {
          const res = await fetch(`${API}/screenshot`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file_path: video.file_path, timestamp }),
          });
          const data = await res.json();
          return data.url || null;
        } catch { return null; }
      },
    }),
    {
      name: "neurostream-v2",
      partialize: (state) => ({
        volume: state.volume,
        isMuted: state.isMuted,
        sidebarCollapsed: state.sidebarCollapsed,
        folderPath: state.folderPath,
        theme: state.theme,
        autoPlayNext: state.autoPlayNext,
      }),
    }
  )
);
