import { useRef, useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";

export default function MiniPlayer({ onExpand }) {
  const { currentVideo, setCurrentVideo, volume, isMuted } = useAppStore();
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCT] = useState(0);

  useEffect(() => {
    if (!currentVideo || !videoRef.current) return;
    const mini = videoRef.current;
    mini.src = currentVideo.url;
    mini.volume = isMuted ? 0 : volume;
    mini.muted = isMuted;

    // Try to sync from sessionStorage
    const saved = parseFloat(sessionStorage.getItem("ns_time") || "0");
    mini.currentTime = saved;
    mini.play().catch(() => {});

    const saveTime = () => sessionStorage.setItem("ns_time", mini.currentTime);
    mini.addEventListener("timeupdate", saveTime);
    return () => mini.removeEventListener("timeupdate", saveTime);
  }, [currentVideo]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = isMuted ? 0 : volume;
    videoRef.current.muted = isMuted;
  }, [volume, isMuted]);

  if (!currentVideo) return null;

  return (
    <div style={{
      position: "fixed", bottom: "16px", left: "50%",
      transform: "translateX(-50%)",
      width: "440px",
      background: "rgba(10,10,10,0.98)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "14px", padding: "10px 14px",
      display: "flex", alignItems: "center", gap: "12px",
      zIndex: 450,
      boxShadow: "0 8px 48px rgba(0,0,0,0.9), 0 0 0 1px rgba(229,9,20,0.1)",
      backdropFilter: "blur(24px)",
      animation: "fadeIn 0.25s ease",
    }}>
      {/* Thumbnail preview */}
      <div onClick={onExpand} style={{
        width: "76px", height: "44px", borderRadius: "8px",
        overflow: "hidden", flexShrink: 0, cursor: "pointer",
        background: "#000", position: "relative",
      }}>
        <video
          ref={videoRef}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={e => {
            const v = e.target;
            setCT(v.currentTime);
            if (v.duration) setProgress((v.currentTime / v.duration) * 100);
          }}
        />
      </div>

      {/* Title + progress */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <div style={{
          fontSize: "12px", fontWeight: 600, color: "#fff",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "6px",
        }}>
          {currentVideo.title}
        </div>
        <div
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            if (videoRef.current) videoRef.current.currentTime = ratio * videoRef.current.duration;
          }}
          style={{ height: "3px", background: "rgba(255,255,255,0.12)", borderRadius: "2px", cursor: "pointer" }}
        >
          <div style={{ height: "100%", width: `${progress}%`, background: "#e50914", borderRadius: "2px", transition: "width 0.4s" }} />
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
        <MBtn onClick={() => { if (videoRef.current) videoRef.current.currentTime -= 10; }}>⏪</MBtn>
        <MBtn onClick={() => { const v = videoRef.current; if (v) v.paused ? v.play() : v.pause(); }}>
          {playing ? "⏸" : "▶"}
        </MBtn>
        <MBtn onClick={() => { if (videoRef.current) videoRef.current.currentTime += 10; }}>⏩</MBtn>
        <MBtn onClick={onExpand} title="Back to player">⬆</MBtn>
        <MBtn onClick={() => setCurrentVideo(null)} title="Close">✕</MBtn>
      </div>
    </div>
  );
}

function MBtn({ children, onClick, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: "rgba(255,255,255,0.07)", border: "none", color: "#fff",
      borderRadius: "7px", width: "30px", height: "30px",
      cursor: "pointer", fontSize: "13px",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "background 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.16)"}
      onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
    >{children}</button>
  );
}