import { useState, useRef, useEffect } from "react";

function fmt(sec) {
  if (!sec || sec <= 0) return "";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
}
function fmtSize(b) {
  if (!b) return "";
  return b > 1e9 ? `${(b / 1e9).toFixed(1)}GB` : `${(b / 1e6).toFixed(0)}MB`;
}
function qualityBadge(res) {
  if (!res || res === "Unknown") return null;
  const h = parseInt(res.split("x")[1] || 0);
  if (h >= 2160) return { label: "4K",  color: "#3ddc84" };
  if (h >= 1440) return { label: "2K",  color: "#3ddc84" };
  if (h >= 1080) return { label: "FHD", color: "#4a9eff" };
  if (h >= 720)  return { label: "HD",  color: "#f5a623" };
  return { label: "SD", color: "#888" };
}

export default function VideoCard({ video, isActive, onClick, onQueue, onRemove, progress }) {
  const [hovered, setHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [thumbnail, setThumbnail] = useState(video.thumbnail || null);
  const [thumbLoading, setThumbLoading] = useState(!video.thumbnail);
  const [thumbError, setThumbError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const previewRef = useRef(null);
  const cardRef = useRef(null);
  const hoverTimer = useRef(null);
  const thumbFetched = useRef(false);

  const qb = qualityBadge(video.resolution);
  const progressPct = progress && video.duration > 0
    ? Math.min(100, (progress / video.duration) * 100) : 0;

  // Lazy thumbnail fetch
  useEffect(() => {
    if (thumbnail || thumbFetched.current || !video.file_path || video.isNetwork) return;
    thumbFetched.current = true;
    if (video.thumbnail) { setThumbnail(video.thumbnail); setThumbLoading(false); return; }
    fetch(`http://localhost:5000/api/thumbnail-generate?file_path=${encodeURIComponent(video.file_path)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.url) setThumbnail(d.url); setThumbLoading(false); })
      .catch(() => setThumbLoading(false));
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  const handleMouseEnter = () => {
    setHovered(true);
    hoverTimer.current = setTimeout(() => previewRef.current?.play().catch(() => {}), 500);
  };
  const handleMouseLeave = () => {
    setHovered(false);
    clearTimeout(hoverTimer.current);
    if (previewRef.current) { previewRef.current.pause(); previewRef.current.currentTime = 0; }
    setContextMenu(null);
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    setContextMenu(null);
    setConfirmDelete(true);
  };

  const confirmRemove = (e) => {
    e.stopPropagation();
    onRemove?.(video);
    setConfirmDelete(false);
  };

  return (
    <>
      <div
        ref={cardRef}
        className="card-hover"
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={e => {
          e.preventDefault();
          const r = cardRef.current.getBoundingClientRect();
          setContextMenu({ x: e.clientX - r.left, y: e.clientY - r.top });
        }}
        style={{
          cursor: "pointer", borderRadius: "11px",
          overflow: "visible",
          background: isActive ? "rgba(229,9,20,0.07)" : "var(--bg2)",
          border: `1.5px solid ${isActive ? "rgba(229,9,20,0.45)" : hovered ? "rgba(255,255,255,0.1)" : "var(--border)"}`,
          transition: "border-color 0.2s",
          position: "relative",
          animation: "fadeIn 0.2s ease",
        }}
      >
        {/* Thumbnail area */}
        <div style={{ position: "relative", height: "128px", background: "var(--bg3)", borderRadius: "9px 9px 0 0", overflow: "hidden" }}>
          {thumbLoading && !thumbnail && <div className="skeleton" style={{ position: "absolute", inset: 0 }} />}

          {thumbnail && !thumbError && (
            <img src={thumbnail} alt={video.title} onError={() => setThumbError(true)}
              style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity: hovered ? 0 : 1, transition:"opacity 0.3s" }}
            />
          )}

          {(!thumbnail || thumbError) && !thumbLoading && (
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg,#0f0f1a,#1a1a2e,#0d1b2a)", display:"flex", alignItems:"center", justifyContent:"center", opacity: hovered ? 0 : 1, transition:"opacity 0.3s" }}>
              <span style={{ fontSize:"28px", opacity:0.18 }}>🎬</span>
            </div>
          )}

          <video ref={previewRef} src={video.url} muted loop playsInline
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity: hovered ? 1 : 0, transition:"opacity 0.35s" }}
          />

          {hovered && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
              <div style={{ width:"40px", height:"40px", borderRadius:"50%", background:"rgba(229,9,20,0.9)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"15px", boxShadow:"0 4px 16px rgba(229,9,20,0.5)" }}>▶</div>
            </div>
          )}

          {/* Badges */}
          <div style={{ position:"absolute", top:"6px", left:"6px", display:"flex", gap:"4px", flexWrap:"wrap" }}>
            {isActive && <Badge text="NOW PLAYING" bg="var(--red)" color="#fff" />}
            {video.isNetwork && <Badge text="NETWORK" bg="#4a9eff" color="#fff" />}
            {qb && <Badge text={qb.label} bg="rgba(0,0,0,0.75)" color={qb.color} border={`1px solid ${qb.color}55`} />}
          </div>

          {video.duration > 0 && (
            <span style={{ position:"absolute", bottom:"6px", right:"6px", background:"rgba(0,0,0,0.82)", color:"#fff", fontSize:"10px", fontWeight:600, padding:"2px 6px", borderRadius:"4px" }}>
              {fmt(video.duration)}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {progressPct > 1 && (
          <div style={{ height:"3px", background:"rgba(255,255,255,0.08)" }}>
            <div style={{ height:"100%", width:`${progressPct}%`, background:"var(--red)", transition:"width 0.3s" }} />
          </div>
        )}

        {/* Info */}
        <div style={{ padding:"9px 11px 10px" }}>
          <p style={{ margin:"0 0 3px", fontSize:"12.5px", fontWeight:600, color: isActive ? "#fff" : "var(--text2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {video.title}
          </p>
          <div style={{ display:"flex", gap:"6px", alignItems:"center", flexWrap:"wrap" }}>
            {video.resolution && video.resolution !== "Unknown" && <Meta>{video.resolution}</Meta>}
            {video.size > 0 && <Meta>{fmtSize(video.size)}</Meta>}
            {progressPct > 2 && progressPct < 98 && <Meta red>{Math.round(progressPct)}%</Meta>}
          </div>
        </div>

        {/* Context menu */}
        {contextMenu && (
          <div onClick={e => e.stopPropagation()} style={{ position:"absolute", top:contextMenu.y, left:contextMenu.x, background:"rgba(14,14,14,0.98)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"10px", padding:"6px", zIndex:999, minWidth:"180px", boxShadow:"0 12px 40px rgba(0,0,0,0.9)", backdropFilter:"blur(20px)", animation:"scaleIn 0.12s ease" }}>
            {[
              { icon:"▶",  label:"Play now",           action: onClick },
              { icon:"＋", label:"Add to queue",        action: () => { onQueue?.(video); setContextMenu(null); } },
              { icon:"📋", label:"Copy title",          action: () => { navigator.clipboard?.writeText(video.title); setContextMenu(null); } },
              { icon:"🖼", label:"Refresh thumbnail",   action: () => { setThumbnail(null); setThumbLoading(true); thumbFetched.current = false; setContextMenu(null); } },
              { icon:"📂", label:"Show file path",      action: () => { alert(video.file_path || video.url); setContextMenu(null); } },
            ].map((item, i) => (
              <CtxItem key={i} icon={item.icon} label={item.label} onClick={e => { e.stopPropagation(); item.action?.(); }} />
            ))}

            {/* Divider */}
            <div style={{ height:"1px", background:"rgba(255,255,255,0.07)", margin:"4px 0" }} />

            {/* Remove from library */}
            <CtxItem
              icon="🗑"
              label="Remove from library"
              onClick={handleRemove}
              danger
            />
          </div>
        )}
      </div>

      {/* Confirm delete overlay */}
      {confirmDelete && (
        <div
          onClick={e => { e.stopPropagation(); setConfirmDelete(false); }}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:1100, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)", animation:"fadeIn 0.15s ease" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background:"rgba(14,14,14,0.99)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"16px", padding:"28px 32px", width:"340px", textAlign:"center", boxShadow:"0 24px 64px rgba(0,0,0,0.9)" }}
          >
            <div style={{ fontSize:"40px", marginBottom:"14px" }}>🗑</div>
            <h3 style={{ margin:"0 0 8px", fontSize:"16px", fontWeight:700, color:"#fff" }}>Remove from library?</h3>
            <p style={{ margin:"0 0 6px", fontSize:"13px", color:"var(--text2)", lineHeight:1.5 }}>
              <strong style={{ color:"#fff" }}>{video.title}</strong>
            </p>
            <p style={{ margin:"0 0 24px", fontSize:"12px", color:"var(--text3)" }}>
              This removes it from NeuroStream's library only.<br />The actual file on your disk is <strong>not deleted</strong>.
            </p>
            <div style={{ display:"flex", gap:"10px", justifyContent:"center" }}>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{ flex:1, padding:"10px", background:"rgba(255,255,255,0.06)", border:"1px solid var(--border)", color:"#fff", borderRadius:"9px", cursor:"pointer", fontSize:"13px", fontWeight:600, transition:"background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                style={{ flex:1, padding:"10px", background:"rgba(229,9,20,0.15)", border:"1.5px solid rgba(229,9,20,0.5)", color:"#e50914", borderRadius:"9px", cursor:"pointer", fontSize:"13px", fontWeight:700, transition:"all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#e50914"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(229,9,20,0.15)"; e.currentTarget.style.color = "#e50914"; }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Badge({ text, bg, color, border }) {
  return <span style={{ background:bg, color, fontSize:"8px", fontWeight:800, padding:"2px 7px", borderRadius:"4px", letterSpacing:"0.06em", border: border || "none" }}>{text}</span>;
}
function Meta({ children, red }) {
  return <span style={{ fontSize:"10px", color: red ? "var(--red)" : "var(--text3)" }}>{children}</span>;
}
function CtxItem({ icon, label, onClick, danger }) {
  return (
    <div onClick={onClick} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"8px 12px", borderRadius:"7px", fontSize:"12.5px", color: danger ? "#ff6b6b" : "#ccc", cursor:"pointer", transition:"background 0.12s" }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? "rgba(229,9,20,0.12)" : "rgba(255,255,255,0.07)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <span style={{ fontSize:"13px", width:"16px", textAlign:"center" }}>{icon}</span>
      {label}
    </div>
  );
}