import { useState } from "react";
import { useAppStore } from "../store/useAppStore";

const SAMPLE_URLS = [
  { label: "Big Buck Bunny (MP4)", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" },
  { label: "Elephant Dream (MP4)", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4" },
  { label: "Subaru Outback (MP4)", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4" },
];

export default function NetworkURLPlayer({ onClose }) {
  const { setCurrentVideo, setVideos, videos } = useAppStore();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePlay = async () => {
    const trimmed = url.trim();
    if (!trimmed) { setError("Please enter a URL"); return; }
    if (!trimmed.startsWith("http")) { setError("URL must start with http:// or https://"); return; }

    setLoading(true);
    setError("");

    try {
      // Quick HEAD check to see if URL is accessible
      const res = await fetch(trimmed, { method: "HEAD" }).catch(() => null);
      const contentType = res?.headers?.get("content-type") || "";
      const isVideo = contentType.includes("video") || /\.(mp4|mkv|webm|avi|mov|m4v)(\?|$)/i.test(trimmed);

      if (res && !res.ok && res.status !== 206) {
        setError(`Server returned ${res.status}. URL may be invalid or require auth.`);
        setLoading(false);
        return;
      }

      const videoTitle = title.trim() || trimmed.split("/").pop().split("?")[0] || "Network Video";
      const video = {
        id: Date.now(),
        title: videoTitle,
        url: trimmed,
        file_path: trimmed,
        filename: null,
        folder_path: null,
        duration: 0,
        isNetwork: true,
      };

      setVideos([...videos, video]);
      setCurrentVideo(video);
      onClose?.();
    } catch (e) {
      setError("Could not load URL: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 600, display: "flex",
        alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(8px)",
        animation: "fadeIn 0.15s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "rgba(12,12,12,0.99)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "16px", padding: "28px",
          width: "480px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.9)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>🌐 Network URL</h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text3)" }}>Play any direct video URL</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "20px" }}>✕</button>
        </div>

        {/* URL input */}
        <div style={{ marginBottom: "12px" }}>
          <label style={{ fontSize: "11px", color: "var(--text3)", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>VIDEO URL</label>
          <input
            type="text"
            placeholder="https://example.com/video.mp4"
            value={url}
            onChange={e => { setUrl(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handlePlay()}
            autoFocus
            style={{
              width: "100%", padding: "10px 14px",
              background: "rgba(255,255,255,0.06)",
              border: error ? "1px solid rgba(229,9,20,0.6)" : "1px solid rgba(255,255,255,0.1)",
              borderRadius: "9px", color: "#fff",
              fontSize: "13px", fontFamily: "monospace",
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Optional title */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ fontSize: "11px", color: "var(--text3)", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>TITLE (optional)</label>
          <input
            type="text"
            placeholder="My Video"
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={{
              width: "100%", padding: "10px 14px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "9px", color: "#fff",
              fontSize: "13px", fontFamily: "inherit",
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {error && (
          <div style={{ background: "rgba(229,9,20,0.1)", border: "1px solid rgba(229,9,20,0.3)", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px", fontSize: "12px", color: "#ff6b6b" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Play button */}
        <button
          onClick={handlePlay}
          disabled={loading || !url.trim()}
          style={{
            width: "100%", padding: "12px",
            background: loading || !url.trim() ? "rgba(229,9,20,0.4)" : "linear-gradient(135deg, #e50914, #c40812)",
            border: "none", color: "#fff", borderRadius: "10px",
            fontSize: "14px", fontWeight: 700, cursor: loading || !url.trim() ? "not-allowed" : "pointer",
            transition: "all 0.2s", marginBottom: "20px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          }}
        >
          {loading ? (
            <><div style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Checking URL...</>
          ) : "▶ Play Now"}
        </button>

        {/* Sample URLs */}
        <div>
          <div style={{ fontSize: "11px", color: "var(--text3)", letterSpacing: "0.06em", marginBottom: "8px" }}>SAMPLE VIDEOS TO TRY</div>
          {SAMPLE_URLS.map((s, i) => (
            <div
              key={i}
              onClick={() => { setUrl(s.url); setTitle(s.label); setError(""); }}
              style={{
                padding: "8px 12px", borderRadius: "7px", cursor: "pointer",
                fontSize: "12px", color: "var(--text2)",
                display: "flex", alignItems: "center", gap: "8px",
                transition: "background 0.15s", marginBottom: "2px",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ color: "var(--text3)", fontSize: "11px" }}>▶</span>
              {s.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}