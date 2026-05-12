import { useEffect, useState, useRef } from "react";
import { useAppStore } from "../store/useAppStore";

function fmtTime(s) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, "0")}`;
}

export default function MiniPlayer({ onExpand }) {
  const { currentVideo, setCurrentVideo } = useAppStore();
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [ct, setCT]             = useState(0);
  const [dur, setDur]           = useState(0);
  const tickRef = useRef(null);

  // Get the EXISTING main video element — never create a new one
  const getVideo = () => document.getElementById("main-video");

  // Sync state from the real video element
  useEffect(() => {
    const sync = () => {
      const v = getVideo();
      if (!v) return;
      setPlaying(!v.paused);
      setCT(v.currentTime);
      setDur(v.duration || 0);
      setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0);
    };

    // Poll every 500ms — lightweight, works even when video is off-screen
    tickRef.current = setInterval(sync, 500);
    sync(); // immediate sync

    return () => clearInterval(tickRef.current);
  }, [currentVideo]);

  if (!currentVideo) return null;

  const togglePlay = () => {
    const v = getVideo();
    if (!v) return;
    v.paused ? v.play() : v.pause();
    setPlaying(!v.paused);
  };

  const skip = (secs) => {
    const v = getVideo();
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + secs));
  };

  const seek = (e) => {
    const v = getVideo();
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * v.duration;
  };

  const close = () => {
    const v = getVideo();
    if (v) v.pause();
    setCurrentVideo(null);
  };

  return (
    <div style={{
      position: "fixed", bottom: "16px", left: "50%",
      transform: "translateX(-50%)",
      width: "460px",
      background: "rgba(10,10,10,0.98)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "14px", padding: "10px 14px",
      display: "flex", alignItems: "center", gap: "12px",
      zIndex: 450,
      boxShadow: "0 8px 48px rgba(0,0,0,0.9), 0 0 0 1px rgba(229,9,20,0.08)",
      backdropFilter: "blur(24px)",
      animation: "fadeIn 0.25s ease",
    }}>
      {/* Thumbnail — clicking expands back to home */}
      <div
        onClick={onExpand}
        style={{
          width: "72px", height: "42px",
          borderRadius: "8px", overflow: "hidden",
          flexShrink: 0, cursor: "pointer",
          background: "#111",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "20px",
        }}
      >
        {currentVideo.thumbnail
          ? <img src={currentVideo.thumbnail} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
          : "🎬"
        }
      </div>

      {/* Title + progress */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <div style={{
          fontSize: "12px", fontWeight: 600, color: "#fff",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          marginBottom: "5px",
        }}>
          {currentVideo.title}
        </div>
        {/* Seekable progress bar */}
        <div
          onClick={seek}
          style={{
            height: "3px", background: "rgba(255,255,255,0.12)",
            borderRadius: "2px", cursor: "pointer", position: "relative",
          }}
          onMouseEnter={e => e.currentTarget.style.height = "5px"}
          onMouseLeave={e => e.currentTarget.style.height = "3px"}
        >
          <div style={{
            height: "100%", width: `${progress}%`,
            background: "#e50914", borderRadius: "2px",
            transition: "width 0.4s linear",
          }}/>
        </div>
        <div style={{ display:"flex",justifyContent:"space-between",marginTop:"3px" }}>
          <span style={{ fontSize:"10px",color:"var(--text3)" }}>{fmtTime(ct)}</span>
          <span style={{ fontSize:"10px",color:"var(--text3)" }}>{fmtTime(dur)}</span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
        <MBtn onClick={() => skip(-10)} title="Back 10s">⏪</MBtn>
        <MBtn onClick={togglePlay} title="Play/Pause">
          {playing ? "⏸" : "▶"}
        </MBtn>
        <MBtn onClick={() => skip(10)} title="Forward 10s">⏩</MBtn>
        <MBtn onClick={onExpand} title="Back to player">⬆</MBtn>
        <MBtn onClick={close} title="Close">✕</MBtn>
      </div>
    </div>
  );
}

function MBtn({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: "rgba(255,255,255,0.07)",
        border: "none", color: "#fff",
        borderRadius: "7px", width: "30px", height: "30px",
        cursor: "pointer", fontSize: "13px",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.16)"}
      onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
    >
      {children}
    </button>
  );
}