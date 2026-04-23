import { useState, useRef } from "react";

function formatDuration(sec) {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  return `${(bytes / 1e6).toFixed(0)} MB`;
}

export default function VideoCard({ video, isActive, onClick }) {
  const [hovered, setHovered] = useState(false);
  const previewRef = useRef(null);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => {
        setHovered(true);
        setTimeout(() => previewRef.current?.play().catch(() => {}), 300);
      }}
      onMouseLeave={() => {
        setHovered(false);
        if (previewRef.current) {
          previewRef.current.pause();
          previewRef.current.currentTime = 0;
        }
      }}
      style={{
        cursor: "pointer",
        borderRadius: "10px",
        overflow: "hidden",
        background: isActive ? "#1a1a2e" : "#111",
        border: isActive ? "2px solid #e50914" : "2px solid transparent",
        transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
        transform: hovered ? "scale(1.04)" : "scale(1)",
        boxShadow: hovered ? "0 16px 40px rgba(0,0,0,0.8)" : "0 4px 12px rgba(0,0,0,0.4)",
        position: "relative",
        zIndex: hovered ? 10 : 1,
      }}
    >
      {/* Thumbnail / Preview */}
      <div style={{ position: "relative", height: "130px", background: "#1a1a1a", overflow: "hidden" }}>
        {hovered ? (
          <video
            ref={previewRef}
            src={video.url}
            muted
            loop
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)`,
            fontSize: "32px",
            position: "relative",
          }}>
            <span style={{ opacity: 0.5 }}>🎬</span>
            {/* Decorative corner accent */}
            <div style={{
              position: "absolute", bottom: 0, right: 0,
              width: 0, height: 0,
              borderLeft: "40px solid transparent",
              borderBottom: "40px solid rgba(229,9,20,0.3)",
            }} />
          </div>
        )}

        {/* Duration badge */}
        {video.duration > 0 && (
          <div style={{
            position: "absolute", bottom: "6px", right: "6px",
            background: "rgba(0,0,0,0.8)",
            color: "#fff",
            fontSize: "11px",
            padding: "2px 6px",
            borderRadius: "4px",
            fontWeight: 600,
          }}>
            {formatDuration(video.duration)}
          </div>
        )}

        {/* Play overlay on hover */}
        {!hovered && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: 0,
            transition: "opacity 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = "1"}
            onMouseLeave={e => e.currentTarget.style.opacity = "0"}
          >
            <div style={{
              width: "44px", height: "44px", borderRadius: "50%",
              background: "rgba(229,9,20,0.9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "18px",
            }}>▶</div>
          </div>
        )}

        {isActive && (
          <div style={{
            position: "absolute", top: "6px", left: "6px",
            background: "#e50914", color: "#fff",
            fontSize: "10px", padding: "2px 8px",
            borderRadius: "4px", fontWeight: 700, letterSpacing: "0.05em",
          }}>NOW PLAYING</div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "10px 12px" }}>
        <p style={{
          margin: 0, fontSize: "13px", fontWeight: 600,
          color: "#fff", lineHeight: 1.4,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {video.title}
        </p>
        <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
          {video.resolution && video.resolution !== "Unknown" && (
            <span style={{ fontSize: "10px", color: "#888" }}>{video.resolution}</span>
          )}
          {video.size > 0 && (
            <span style={{ fontSize: "10px", color: "#888" }}>{formatSize(video.size)}</span>
          )}
        </div>
      </div>
    </div>
  );
}