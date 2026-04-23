import { useEffect, useRef, useState, useCallback } from "react";
import { useAppStore } from "../store/useAppStore";

function formatTime(sec) {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

function formatSize(bytes) {
  if (!bytes) return "—";
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  return `${(bytes / 1e6).toFixed(1)} MB`;
}

// Quality levels — for local files we show the native resolution
// and let user pick a CSS "quality feel" (sharpness filter simulation)
// For real transcoding you'd need ffmpeg server-side (Phase 2)
const QUALITY_LEVELS = [
  { label: "4K", value: "2160p", scale: 1, note: "Ultra HD" },
  { label: "1440p", value: "1440p", scale: 1, note: "2K QHD" },
  { label: "1080p", value: "1080p", scale: 1, note: "Full HD" },
  { label: "720p",  value: "720p",  scale: 1, note: "HD" },
  { label: "480p",  value: "480p",  scale: 1, note: "SD" },
  { label: "360p",  value: "360p",  scale: 1, note: "Low" },
  { label: "240p",  value: "240p",  scale: 1, note: "Very Low" },
  { label: "144p",  value: "144p",  scale: 1, note: "Minimum" },
];

// Map resolution string to closest quality label
function resolveNativeQuality(resolution) {
  if (!resolution || resolution === "Unknown") return null;
  const [w, h] = resolution.split("x").map(Number);
  const height = h || w;
  if (height >= 2160) return "2160p";
  if (height >= 1440) return "1440p";
  if (height >= 1080) return "1080p";
  if (height >= 720)  return "720p";
  if (height >= 480)  return "480p";
  if (height >= 360)  return "360p";
  if (height >= 240)  return "240p";
  return "144p";
}

export default function VideoPlayer({ onClose }) {
  const { currentVideo, volume, isMuted, setVolume, setMuted, saveProgress } = useAppStore();
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const progressRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const subtitleInputRef = useRef(null);

  const [playing, setPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [brightness, setBrightness] = useState(100);

  // Subtitle state
  const [subtitleUrl, setSubtitleUrl] = useState(null);
  const [subtitleLabel, setSubtitleLabel] = useState(null);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);

  // Panel state — only one open at a time
  const [openPanel, setOpenPanel] = useState(null); // null | "cc" | "settings"

  // Video info (detected from metadata)
  const [videoInfo, setVideoInfo] = useState({
    resolution: null,
    nativeQuality: null,
    width: 0,
    height: 0,
    fps: null,
  });

  // Selected quality (simulated for local files)
  const [selectedQuality, setSelectedQuality] = useState(null);

  const togglePanel = (name) => setOpenPanel(p => p === name ? null : name);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  // Load video
  useEffect(() => {
    if (!currentVideo) return;
    const v = videoRef.current;
    if (!v) return;

    v.src = currentVideo.url;
    v.volume = isMuted ? 0 : volume;
    v.muted = isMuted;
    v.playbackRate = playbackRate;
    setCurrentTime(0);
    setDuration(0);
    setSubtitleUrl(null);
    setSubtitleLabel(null);
    setOpenPanel(null);

    // Set quality from stored metadata
    const nq = resolveNativeQuality(currentVideo.resolution);
    setSelectedQuality(nq);
    setVideoInfo({
      resolution: currentVideo.resolution || null,
      nativeQuality: nq,
      width: 0,
      height: 0,
      fps: null,
    });

    // Auto-detect subtitle
    if (currentVideo.filename && currentVideo.folder_path) {
      const subUrl = `http://localhost:5000/api/subtitle/${encodeURIComponent(currentVideo.filename)}?folder=${encodeURIComponent(currentVideo.folder_path)}`;
      fetch(subUrl, { method: "HEAD" })
        .then(r => { if (r.ok) { setSubtitleUrl(subUrl); setSubtitleLabel("Auto-detected"); } })
        .catch(() => {});
    }

    v.play().catch(() => {});
    return () => clearTimeout(controlsTimerRef.current);
  }, [currentVideo]);

  // Detect actual video dimensions once loaded
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const handler = () => {
      const w = v.videoWidth;
      const h = v.videoHeight;
      if (w && h) {
        const nq = resolveNativeQuality(`${w}x${h}`);
        setVideoInfo(prev => ({ ...prev, width: w, height: h, resolution: `${w}x${h}`, nativeQuality: nq }));
        setSelectedQuality(nq);
      }
    };
    v.addEventListener("loadedmetadata", handler);
    return () => v.removeEventListener("loadedmetadata", handler);
  }, [currentVideo]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = isMuted ? 0 : volume;
    v.muted = isMuted;
  }, [volume, isMuted]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      const v = videoRef.current;
      if (!v) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "SELECT") return;

      switch (e.key) {
        case " ": case "k": e.preventDefault(); v.paused ? v.play() : v.pause(); break;
        case "ArrowRight": case "l": v.currentTime = Math.min(v.duration, v.currentTime + 10); break;
        case "ArrowLeft": case "j": v.currentTime = Math.max(0, v.currentTime - 10); break;
        case "ArrowUp":
          e.preventDefault();
          const vu = Math.min(1, volume + 0.1);
          setVolume(vu); setMuted(false);
          if (videoRef.current) videoRef.current.volume = vu;
          break;
        case "ArrowDown":
          e.preventDefault();
          const vd = Math.max(0, volume - 0.1);
          setVolume(vd);
          if (videoRef.current) videoRef.current.volume = vd;
          break;
        case "m": setMuted(!isMuted); break;
        case "f": toggleFullscreen(); break;
        case "Escape":
          if (openPanel) { setOpenPanel(null); break; }
          if (isFullscreen) toggleFullscreen();
          else onClose?.();
          break;
        case ".": { const nr = Math.min(3, playbackRate + 0.25); setPlaybackRate(nr); if (videoRef.current) videoRef.current.playbackRate = nr; break; }
        case ",": { const pr = Math.max(0.25, playbackRate - 0.25); setPlaybackRate(pr); if (videoRef.current) videoRef.current.playbackRate = pr; break; }
      }
      resetControlsTimer();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [playing, volume, isMuted, isFullscreen, playbackRate, openPanel]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleProgressClick = (e) => {
    const v = videoRef.current;
    const bar = progressRef.current;
    if (!v || !bar || !v.duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * v.duration;
  };

  const handleSubtitleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSubtitleUrl(URL.createObjectURL(file));
    setSubtitleLabel(file.name);
    setSubtitlesEnabled(true);
    setOpenPanel(null);
  };

  // Quality selection — for local files this is informational + visual only
  // Real adaptive streaming would need HLS transcoding on the backend
  const handleQualitySelect = (q) => {
    setSelectedQuality(q.value);
    setOpenPanel(null);

    // Apply CSS sharpness simulation for lower qualities
    const v = videoRef.current;
    if (!v) return;
    const qualityFilters = {
      "2160p": "none",
      "1440p": "none",
      "1080p": "none",
      "720p":  "none",
      "480p":  "blur(0.3px)",
      "360p":  "blur(0.6px)",
      "240p":  "blur(1px)",
      "144p":  "blur(1.8px)",
    };
    v.style.filter = `brightness(${brightness}%) ${qualityFilters[q.value] || "none"}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;

  if (!currentVideo) return null;

  // Available qualities — only show up to native resolution
  const nativeIndex = QUALITY_LEVELS.findIndex(q => q.value === videoInfo.nativeQuality);
  const availableQualities = nativeIndex >= 0
    ? QUALITY_LEVELS.slice(nativeIndex)
    : QUALITY_LEVELS;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        background: "#000",
        borderRadius: isFullscreen ? "0" : "14px",
        overflow: "hidden",
        cursor: showControls ? "default" : "none",
        aspectRatio: "16 / 9",
        maxHeight: isFullscreen ? "100vh" : "calc(100vh - 260px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => setShowControls(false)}
      onMouseEnter={resetControlsTimer}
      onClick={() => { if (openPanel) setOpenPanel(null); }}
    >
      {/* VIDEO */}
      <video
        ref={videoRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          background: "#000",
          display: "block",
          filter: `brightness(${brightness}%)`,
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (openPanel) { setOpenPanel(null); return; }
          const v = videoRef.current;
          if (v) v.paused ? v.play() : v.pause();
          resetControlsTimer();
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          setCurrentTime(e.target.currentTime);
          const b = e.target.buffered;
          if (b.length > 0) setBuffered(b.end(b.length - 1));
          if (Math.floor(e.target.currentTime) % 5 === 0) {
            saveProgress(currentVideo, e.target.currentTime, e.target.duration || 0);
          }
        }}
        onLoadedMetadata={(e) => {
          setDuration(e.target.duration);
          e.target.playbackRate = playbackRate;
        }}
        onEnded={() => { setPlaying(false); saveProgress(currentVideo, duration, duration); }}
        crossOrigin="anonymous"
      >
        {subtitleUrl && subtitlesEnabled && (
          <track key={subtitleUrl} kind="subtitles" src={subtitleUrl} default label={subtitleLabel || "Subtitles"} />
        )}
      </video>

      {/* BOTTOM GRADIENT */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: "200px",
        background: "linear-gradient(transparent, rgba(0,0,0,0.97))",
        pointerEvents: "none",
        opacity: showControls ? 1 : 0,
        transition: "opacity 0.3s",
      }} />

      {/* ── SUBTITLE PANEL ── */}
      {openPanel === "cc" && (
        <Panel title="Subtitles" onClose={() => setOpenPanel(null)}>
          <PanelOption label="Off" active={!subtitlesEnabled} onClick={() => { setSubtitlesEnabled(false); setOpenPanel(null); }} />
          {subtitleUrl && (
            <PanelOption
              label={subtitleLabel || "Loaded subtitle"}
              active={subtitlesEnabled}
              onClick={() => { setSubtitlesEnabled(true); setOpenPanel(null); }}
            />
          )}
          <div
            onClick={() => subtitleInputRef.current?.click()}
            style={{ padding: "10px 14px", cursor: "pointer", fontSize: "13px", color: "#e50914", display: "flex", alignItems: "center", gap: "8px", borderRadius: "7px", transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(229,9,20,0.1)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            📂 Load subtitle file (.srt / .vtt)
          </div>
          <input ref={subtitleInputRef} type="file" accept=".srt,.vtt" style={{ display: "none" }} onChange={handleSubtitleFile} />
        </Panel>
      )}

      {/* ── SETTINGS PANEL ── */}
      {openPanel === "settings" && (
        <Panel title="Video Settings" onClose={() => setOpenPanel(null)} wide>
          {/* Video Info Section */}
          <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "12px", marginBottom: "12px" }}>
            <SectionLabel>Video Info</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <InfoRow label="Resolution" value={videoInfo.width && videoInfo.height ? `${videoInfo.width} × ${videoInfo.height}` : (videoInfo.resolution || "Detecting...")} />
              <InfoRow label="Native Quality" value={videoInfo.nativeQuality || "—"} highlight />
              <InfoRow label="File Size" value={formatSize(currentVideo.size)} />
              <InfoRow label="Duration" value={duration > 0 ? formatTime(duration) : "—"} />
              <InfoRow label="Speed" value={`${playbackRate}x`} />
              <InfoRow label="Brightness" value={`${brightness}%`} />
            </div>
          </div>

          {/* Quality Selection */}
          <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "12px", marginBottom: "12px" }}>
            <SectionLabel>Quality</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
              {availableQualities.map(q => {
                const isNative = q.value === videoInfo.nativeQuality;
                const isSelected = q.value === selectedQuality;
                return (
                  <button
                    key={q.value}
                    onClick={() => handleQualitySelect(q)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "20px",
                      border: isSelected ? "1.5px solid #e50914" : "1.5px solid rgba(255,255,255,0.15)",
                      background: isSelected ? "rgba(229,9,20,0.18)" : "rgba(255,255,255,0.05)",
                      color: isSelected ? "#fff" : "#aaa",
                      fontSize: "12px",
                      fontWeight: isSelected ? 700 : 400,
                      cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: "1px",
                      transition: "all 0.15s",
                      position: "relative",
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)"; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
                  >
                    <span style={{ fontSize: "13px", fontWeight: 700 }}>{q.label}</span>
                    <span style={{ fontSize: "10px", color: isSelected ? "#e50914" : "#666" }}>{q.note}</span>
                    {isNative && (
                      <span style={{
                        position: "absolute", top: "-7px", right: "-4px",
                        background: "#3ddc84", color: "#000",
                        fontSize: "8px", fontWeight: 800,
                        padding: "1px 5px", borderRadius: "4px",
                        letterSpacing: "0.05em",
                      }}>NATIVE</span>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedQuality && selectedQuality !== videoInfo.nativeQuality && (
              <div style={{ fontSize: "11px", color: "#f5a623", marginTop: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                ⚠️ Quality below native — visual blur applied. For true transcoding, ffmpeg server-side encoding is needed.
              </div>
            )}
          </div>

          {/* Playback Speed */}
          <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "12px", marginBottom: "12px" }}>
            <SectionLabel>Playback Speed</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
              {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3].map(r => (
                <button
                  key={r}
                  onClick={() => { setPlaybackRate(r); if (videoRef.current) videoRef.current.playbackRate = r; }}
                  style={{
                    padding: "5px 12px", borderRadius: "16px",
                    border: playbackRate === r ? "1.5px solid #e50914" : "1.5px solid rgba(255,255,255,0.12)",
                    background: playbackRate === r ? "rgba(229,9,20,0.18)" : "rgba(255,255,255,0.04)",
                    color: playbackRate === r ? "#fff" : "#888",
                    fontSize: "12px", fontWeight: playbackRate === r ? 700 : 400,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {r === 1 ? "Normal" : `${r}x`}
                </button>
              ))}
            </div>
          </div>

          {/* Brightness */}
          <div>
            <SectionLabel>Brightness — {brightness}%</SectionLabel>
            <input
              type="range" min="40" max="160" step="5" value={brightness}
              onChange={e => {
                const val = e.target.value;
                setBrightness(val);
                if (videoRef.current) videoRef.current.style.filter = `brightness(${val}%)`;
              }}
              style={{ width: "100%", accentColor: "#f5a623", marginTop: "8px", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#555", marginTop: "2px" }}>
              <span>40% (Dark)</span><span>100% (Normal)</span><span>160% (Bright)</span>
            </div>
          </div>
        </Panel>
      )}

      {/* ── CONTROLS ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "16px 20px 14px",
        opacity: showControls ? 1 : 0,
        pointerEvents: showControls ? "auto" : "none",
        transition: "opacity 0.3s",
        zIndex: 10,
      }}>
        {/* Title + time */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55%" }}>
            {currentVideo.title}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            {selectedQuality && (
              <span style={{
                fontSize: "10px", fontWeight: 700, padding: "2px 8px",
                background: "rgba(229,9,20,0.2)", border: "1px solid rgba(229,9,20,0.4)",
                borderRadius: "4px", color: "#e50914", letterSpacing: "0.05em",
              }}>
                {selectedQuality}
              </span>
            )}
            <span style={{ fontSize: "12px", color: "#aaa" }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          style={{ height: "5px", background: "rgba(255,255,255,0.18)", borderRadius: "3px", marginBottom: "14px", cursor: "pointer", position: "relative" }}
          onMouseEnter={e => e.currentTarget.style.height = "7px"}
          onMouseLeave={e => e.currentTarget.style.height = "5px"}
        >
          <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${bufferedPercent}%`, background: "rgba(255,255,255,0.25)", borderRadius: "3px" }} />
          <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${progressPercent}%`, background: "#e50914", borderRadius: "3px" }} />
          <div style={{ position: "absolute", top: "50%", left: `${progressPercent}%`, transform: "translate(-50%, -50%)", width: "13px", height: "13px", background: "#fff", borderRadius: "50%", boxShadow: "0 0 6px rgba(0,0,0,0.8)" }} />
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <Btn onClick={() => { if (videoRef.current) videoRef.current.currentTime -= 10; }} title="Back 10s">⏪</Btn>
          <Btn onClick={() => { const v = videoRef.current; v && (v.paused ? v.play() : v.pause()); }} large>
            {playing ? "⏸" : "▶"}
          </Btn>
          <Btn onClick={() => { if (videoRef.current) videoRef.current.currentTime += 10; }} title="Forward 10s">⏩</Btn>

          <Btn onClick={() => setMuted(!isMuted)} title="Mute (M)">
            {isMuted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
          </Btn>
          <input
            type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume}
            onChange={e => { const v = parseFloat(e.target.value); setVolume(v); setMuted(v === 0); if (videoRef.current) videoRef.current.volume = v; }}
            style={{ width: "70px", accentColor: "#e50914", cursor: "pointer", flexShrink: 0 }}
          />

          <div style={{ flex: 1 }} />

          {/* CC Button */}
          <Btn onClick={(e) => { e.stopPropagation(); togglePanel("cc"); }} active={openPanel === "cc" || (subtitleUrl && subtitlesEnabled)} title="Subtitles">
            CC
          </Btn>

          {/* Settings / Gear */}
          <Btn onClick={(e) => { e.stopPropagation(); togglePanel("settings"); }} active={openPanel === "settings"} title="Settings">
            ⚙
          </Btn>

          {/* Fullscreen */}
          <Btn onClick={toggleFullscreen} title="Fullscreen (F)">⛶</Btn>

          {onClose && <Btn onClick={onClose} title="Close">✕</Btn>}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function Panel({ title, onClose, children, wide }) {
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: "absolute", bottom: "80px", right: "16px",
        background: "rgba(12,12,12,0.97)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "14px",
        padding: "16px",
        width: wide ? "360px" : "240px",
        maxHeight: "70vh",
        overflowY: "auto",
        boxShadow: "0 16px 48px rgba(0,0,0,0.9)",
        backdropFilter: "blur(20px)",
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>{title}</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}>✕</button>
      </div>
      {children}
    </div>
  );
}

function PanelOption({ label, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "9px 12px", borderRadius: "7px", cursor: "pointer",
        fontSize: "13px", color: active ? "#fff" : "#888",
        background: active ? "rgba(229,9,20,0.15)" : "transparent",
        display: "flex", alignItems: "center", gap: "8px",
        transition: "background 0.15s", marginBottom: "2px",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = active ? "rgba(229,9,20,0.15)" : "transparent"; }}
    >
      <span style={{ color: active ? "#e50914" : "transparent", fontSize: "11px", width: "12px" }}>✓</span>
      {label}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: "10px", fontWeight: 700, color: "#666", letterSpacing: "0.1em", marginBottom: "4px", textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

function InfoRow({ label, value, highlight }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "7px", padding: "8px 10px" }}>
      <div style={{ fontSize: "10px", color: "#555", marginBottom: "2px", letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: "13px", fontWeight: 600, color: highlight ? "#e50914" : "#fff" }}>{value}</div>
    </div>
  );
}

function Btn({ children, onClick, title, large, active }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: active ? "rgba(229,9,20,0.2)" : "none",
        border: active ? "1px solid rgba(229,9,20,0.4)" : "none",
        color: active ? "#e50914" : "#fff",
        fontSize: large ? "20px" : "15px",
        cursor: "pointer", padding: "5px 8px",
        borderRadius: "7px", transition: "background 0.15s",
        lineHeight: 1, flexShrink: 0,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "none"; }}
    >
      {children}
    </button>
  );
}