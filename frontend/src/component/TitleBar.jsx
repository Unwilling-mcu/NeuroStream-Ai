import { useState } from "react";
import { useAppStore } from "../store/useAppStore";

export default function TitleBar({ onSort, sortBy, sortDir }) {
  const { search, searchQuery, setCurrentVideo, videos } = useAppStore();
  const isElectron = !!window.electronAPI;
  const [focused, setFocused] = useState(false);

  return (
    <div style={{
      height: "48px",
      background: "rgba(6,6,6,0.98)",
      backdropFilter: "blur(24px)",
      borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center",
      padding: "0 14px", gap: "10px",
      WebkitAppRegion: "drag",
      flexShrink: 0, zIndex: 200,
    }}>

      {/* Search */}
      <div style={{
        display: "flex", alignItems: "center",
        background: focused ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.05)",
        borderRadius: "9px",
        padding: "0 12px",
        border: focused ? "1px solid rgba(255,255,255,0.15)" : "1px solid var(--border)",
        WebkitAppRegion: "no-drag",
        width: "320px", flexShrink: 0,
        transition: "all 0.2s",
      }}>
        <span style={{ color: "var(--text3)", fontSize: "13px", marginRight: "8px", flexShrink: 0 }}>⌕</span>
        <input
          type="text"
          placeholder="Search library..."
          value={searchQuery}
          onChange={e => search(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            background: "none", border: "none", outline: "none",
            color: "#fff", fontSize: "13px", width: "100%",
            padding: "9px 0", fontFamily: "inherit",
          }}
        />
        {searchQuery && (
          <button
            onClick={() => search("")}
            style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "13px", padding: "0 2px", flexShrink: 0 }}
          >✕</button>
        )}
      </div>

      {/* Sort controls */}
      {onSort && (
        <div style={{ display: "flex", gap: "4px", WebkitAppRegion: "no-drag" }}>
          {["name", "duration", "size", "date"].map(s => (
            <button
              key={s}
              onClick={() => onSort(s)}
              style={{
                background: sortBy === s ? "rgba(229,9,20,0.15)" : "rgba(255,255,255,0.04)",
                border: sortBy === s ? "1px solid rgba(229,9,20,0.35)" : "1px solid var(--border)",
                color: sortBy === s ? "#fff" : "var(--text3)",
                borderRadius: "7px", padding: "4px 10px",
                fontSize: "11px", fontWeight: sortBy === s ? 600 : 400,
                cursor: "pointer", transition: "all 0.15s",
                textTransform: "capitalize",
              }}
            >
              {s} {sortBy === s ? (sortDir === "asc" ? "↑" : "↓") : ""}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, WebkitAppRegion: "drag" }} />

      {/* Shortcut hint */}
      <div style={{ fontSize: "10px", color: "var(--text3)", WebkitAppRegion: "no-drag", letterSpacing: "0.04em" }}>
        Press <kbd style={{ background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: "4px", fontSize: "10px" }}>?</kbd> for shortcuts
      </div>

      {/* Window controls */}
      {isElectron && (
        <div style={{ display: "flex", gap: "5px", WebkitAppRegion: "no-drag" }}>
          <WinBtn color="#f5a623" onClick={() => window.electronAPI.minimize()}>—</WinBtn>
          <WinBtn color="#3ddc84" onClick={() => window.electronAPI.maximize()}>▢</WinBtn>
          <WinBtn color="#e50914" onClick={() => window.electronAPI.close()}>✕</WinBtn>
        </div>
      )}
    </div>
  );
}

function WinBtn({ children, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "28px", height: "28px", borderRadius: "8px",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid var(--border)",
        color: "var(--text3)", cursor: "pointer",
        fontSize: "12px", display: "flex",
        alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = color; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "var(--text3)"; e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      {children}
    </button>
  );
}