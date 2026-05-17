// YoutubeMiniPlayer.jsx
// Persistent audio player for YouTube Music — mounts once in App.jsx,
// never unmounts, so music keeps playing when navigating between pages.
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";

const API = "http://localhost:5000";

function msToTime(sec = 0) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function YoutubeMiniPlayer() {
  const {
    ytTrack, ytStreamUrl, ytPlaying, ytQueue, ytQueueIdx,
    setYtTrack, setYtStreamUrl, setYtPlaying, setYtQueue, setYtQueueIdx,
  } = useAppStore();

  const audioRef  = useRef(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume,   setVolume]   = useState(0.85);
  const [loading,  setLoading]  = useState(false);

  // When a new stream URL arrives → play it
  useEffect(() => {
    if (!ytStreamUrl || !audioRef.current) return;
    audioRef.current.src = ytStreamUrl;
    audioRef.current.volume = volume;
    audioRef.current.play().catch(() => {});
  }, [ytStreamUrl]);

  // Sync playing state from store (e.g. if another component sets it)
  useEffect(() => {
    if (!audioRef.current) return;
    if (ytPlaying && audioRef.current.paused)  audioRef.current.play().catch(() => {});
    if (!ytPlaying && !audioRef.current.paused) audioRef.current.pause();
  }, [ytPlaying]);

  // Auto-advance queue
  const playFromQueue = async (idx) => {
    if (idx < 0 || idx >= ytQueue.length) return;
    const track = ytQueue[idx];
    setLoading(true);
    setYtTrack(track);
    setYtStreamUrl(null);
    setYtQueueIdx(idx);
    try {
      const r = await fetch(`${API}/api/yt/stream-url?id=${encodeURIComponent(track.id)}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setYtStreamUrl(d.url);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const onEnded = () => {
    if (ytQueueIdx >= 0 && ytQueueIdx < ytQueue.length - 1) {
      playFromQueue(ytQueueIdx + 1);
    } else {
      setYtPlaying(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !ytTrack) return;
    audioRef.current.paused ? audioRef.current.play() : audioRef.current.pause();
  };

  const seek = (e) => {
    if (!audioRef.current || !duration) return;
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * duration;
    setProgress(ratio * duration);
  };

  const changeVol = (v) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;
  const canPrev = ytQueueIdx > 0;
  const canNext = ytQueueIdx >= 0 && ytQueueIdx < ytQueue.length - 1;

  if (!ytTrack) return (
    <audio
      ref={audioRef}
      onPlay={() => setYtPlaying(true)}
      onPause={() => setYtPlaying(false)}
      onTimeUpdate={() => { setProgress(audioRef.current?.currentTime || 0); setDuration(audioRef.current?.duration || 0); }}
      onEnded={onEnded}
    />
  );

  return (
    <>
      <audio
        ref={audioRef}
        onPlay={() => setYtPlaying(true)}
        onPause={() => setYtPlaying(false)}
        onTimeUpdate={() => { setProgress(audioRef.current?.currentTime || 0); setDuration(audioRef.current?.duration || 0); }}
        onEnded={onEnded}
      />
      <style>{`@keyframes ns-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(6,6,6,0.98)", backdropFilter: "blur(28px)",
        borderTop: "1px solid rgba(229,9,20,0.2)",
        padding: "10px 24px 12px",
        zIndex: 450,    // below local AudioPlayer (460) so they don't clash
        display: "flex", flexDirection: "column", gap: "8px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>

          {/* YT badge */}
          <div style={{ width: "22px", height: "22px", borderRadius: "5px", background: "#e50914", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 800, color: "#fff", flexShrink: 0 }}>YT</div>

          {/* Thumbnail + info */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
            <div style={{ width: "44px", height: "30px", borderRadius: "4px", overflow: "hidden", flexShrink: 0, background: "rgba(229,9,20,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {loading
                ? <div style={{ width: "14px", height: "14px", border: "2px solid rgba(229,9,20,0.2)", borderTopColor: "#e50914", borderRadius: "50%", animation: "ns-spin 0.7s linear infinite" }} />
                : ytTrack.thumbnail
                  ? <img src={ytTrack.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : "▶"}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ytTrack.title}</div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ytTrack.channel}</div>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <button onClick={() => playFromQueue(ytQueueIdx - 1)} disabled={!canPrev}
              style={{ background: "none", border: "none", color: "#fff", fontSize: "17px", cursor: canPrev ? "pointer" : "not-allowed", opacity: canPrev ? 1 : 0.3, padding: "3px" }}>⏮</button>
            <button onClick={togglePlay}
              style={{ background: "linear-gradient(135deg,#e50914,#c40812)", border: "none", color: "#fff", fontSize: "15px", cursor: "pointer", width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(229,9,20,0.4)", flexShrink: 0 }}>
              {ytPlaying ? "⏸" : "▶"}
            </button>
            <button onClick={() => playFromQueue(ytQueueIdx + 1)} disabled={!canNext}
              style={{ background: "none", border: "none", color: "#fff", fontSize: "17px", cursor: canNext ? "pointer" : "not-allowed", opacity: canNext ? 1 : 0.3, padding: "3px" }}>⏭</button>
          </div>

          {/* Volume */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>🔊</span>
            <input type="range" min="0" max="1" step="0.05" value={volume}
              onChange={e => changeVol(parseFloat(e.target.value))}
              style={{ width: "70px", accentColor: "#e50914" }} />
          </div>

          {/* Queue position */}
          {ytQueue.length > 0 && (
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
              {ytQueueIdx + 1}/{ytQueue.length}
            </span>
          )}

          {/* Close */}
          <button onClick={() => { audioRef.current?.pause(); setYtTrack(null); setYtStreamUrl(null); setYtPlaying(false); }}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: "15px", padding: "3px", flexShrink: 0 }}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", width: "32px", textAlign: "right", flexShrink: 0 }}>{msToTime(progress)}</span>
          <div onClick={seek}
            style={{ flex: 1, height: "3px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.height = "5px"}
            onMouseLeave={e => e.currentTarget.style.height = "3px"}
          >
            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#e50914,#ff4444)", borderRadius: "2px", transition: "width 0.3s linear" }} />
          </div>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", width: "32px", flexShrink: 0 }}>{msToTime(duration)}</span>
        </div>
      </div>
    </>
  );
}