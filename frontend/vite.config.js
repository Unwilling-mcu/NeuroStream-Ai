import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",          // ← critical for Electron: makes asset paths relative
  server: {
    port: 5173,
    strictPort: true,
  },
});