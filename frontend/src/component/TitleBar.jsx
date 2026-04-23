import { useAppStore } from "../store/useAppStore";

export default function TitleBar() {
  const { search, searchQuery } = useAppStore();
  const isElectron = !!window.electronAPI;

  return (
    <div style={{
      height: "46px",
      background: "rgba(8,8,8,0.95)",
      backdropFilter: "blur(20px)",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      display: "flex",
      alignItems: "center",
      padding: "0 16px",
      gap: "12px",
      WebkitAppRegion: "drag",  // Makes the bar draggable in Electron
      flexShrink: 0,
      zIndex: 200,
    }}>
      {/* Search */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center",
        background: "rgba(255,255,255,0.06)",
        borderRadius: "8px", padding: "0 12px",
        border: "1px solid rgba(255,255,255,0.08)",
        WebkitAppRegion: "no-drag",
        maxWidth: "400px",
      }}>
        <span style={{ color: "#555", fontSize: "13px", marginRight: "8px" }}>⌕</span>
        <input
          type="text"
          placeholder="Search your library..."
          value={searchQuery}
          onChange={(e) => search(e.target.value)}
          style={{
            background: "none", border: "none", outline: "none",
            color: "#fff", fontSize: "13px", width: "100%",
            padding: "8px 0",
            fontFamily: "inherit",
          }}
        />
        {searchQuery && (
          <button onClick={() => search("")} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "14px" }}>
            ✕
          </button>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Window controls — Electron only */}
      {isElectron && (
        <div style={{ display: "flex", gap: "6px", WebkitAppRegion: "no-drag" }}>
          <WinBtn color="#f5a623" onClick={() => window.electronAPI.minimize()} title="Minimize">—</WinBtn>
          <WinBtn color="#3ddc84" onClick={() => window.electronAPI.maximize()} title="Maximize/Restore">▢</WinBtn>
          <WinBtn color="#e50914" onClick={() => window.electronAPI.close()} title="Close">✕</WinBtn>
        </div>
      )}
    </div>
  );
}

function WinBtn({ children, onClick, color, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: "28px", height: "28px", borderRadius: "8px",
        background: "rgba(255,255,255,0.06)",
        border: "none", color: "#777",
        cursor: "pointer", fontSize: "13px",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = color;
        e.currentTarget.style.color = "#fff";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "rgba(255,255,255,0.06)";
        e.currentTarget.style.color = "#777";
      }}
    >
      {children}
    </button>
  );
}