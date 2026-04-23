import { create } from "zustand";
import { persist } from "zustand/middleware";

const API = "http://localhost:5000/api";

export const useAppStore = create(
  persist(
    (set, get) => ({
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

      setPage: (page) => set({ currentPage: page }),
      setCurrentVideo: (video) => set({ currentVideo: video, playerVisible: true }),
      setVideos: (videos) => set({ videos }),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setVolume: (v) => set({ volume: v }),
      setMuted: (v) => set({ isMuted: v }),
      setVoiceActive: (v) => set({ voiceActive: v }),

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
          } else {
            const res = await fetch(`${API}/videos`);
            const data = await res.json();
            set({ videos: data });
          }
        } catch (e) {
          console.error("openFolder error:", e);
        } finally {
          set({ isLoading: false });
        }
      },

      openFile: async () => {
        if (!window.electronAPI) return;
        const file = await window.electronAPI.selectFile();
        if (!file) return;
        set(state => ({
          videos: [...state.videos, { ...file, id: Date.now() }],
          currentVideo: file,
          playerVisible: true,
        }));
      },

      loadHistory: async () => {
        try {
          const res = await fetch(`${API}/history`);
          const data = await res.json();
          set({ history: data });
        } catch (e) {}
      },

      saveProgress: async (video, progress, duration) => {
        try {
          await fetch(`${API}/history`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: video.title,
              file_path: video.file_path || video.url,
              progress,
              duration,
            }),
          });
        } catch (e) {}
      },

      search: async (q) => {
        set({ searchQuery: q });
        if (!q.trim()) { set({ searchResults: [] }); return; }
        try {
          const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          set({ searchResults: data });
        } catch (e) {
          const filtered = get().videos.filter(v =>
            v.title.toLowerCase().includes(q.toLowerCase())
          );
          set({ searchResults: filtered });
        }
      },
    }),
    {
      name: "neurostream-store",
      partialize: (state) => ({
        volume: state.volume,
        isMuted: state.isMuted,
        sidebarCollapsed: state.sidebarCollapsed,
        folderPath: state.folderPath,
      }),
    }
  )
);