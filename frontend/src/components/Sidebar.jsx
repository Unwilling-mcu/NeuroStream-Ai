import { useAppStore } from "../store/useAppStore";

const NAV = [
  { id: "home",         icon: "⬡",  label: "Home" },
  { id: "videos",       icon: "🎬", label: "Videos" },
  { id: "audio",        icon: "🎵", label: "Audio" },
  { id: "together",     icon: "👥", label: "Watch Together" },
  { id: "youtube",      icon: "▶",  label: "YouTube Music" },
  { id: "history",      icon: "⏱",  label: "Continue" },
  { id: "settings",     icon: "◈",  label: "Settings" },
];

export default function Sidebar() {
  const { currentPage, setPage, sidebarCollapsed, setSidebarCollapsed, videos, audios, history } = useAppStore();
  const w = sidebarCollapsed ? "64px" : "200px";

  const badges = {
    videos:  videos.length  || null,
    audio:   audios.length  || null,
    history: history.length || null,
  };

  return (
    <aside style={{
      width: w, minWidth: w,
      height: "100%",
      background: "rgba(8,8,8,0.98)",
      backdropFilter: "blur(24px)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      transition: "width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1)",
      overflow: "hidden", flexShrink: 0, zIndex: 100,
    }}>
      {/* Logo — #9 animated glow */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: sidebarCollapsed ? "18px 0" : "18px 16px",
        justifyContent: sidebarCollapsed ? "center" : "flex-start",
        borderBottom: "1px solid var(--border)",
        marginBottom: "6px", flexShrink: 0,
      }}>
        <div
          className="logo-glow"
          style={{
            width: "32px", height: "32px", flexShrink: 0,
            background: "linear-gradient(135deg, var(--red) 0%, #ff4500 100%)",
            borderRadius: "10px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "15px", fontWeight: 900, color: "#fff",
            cursor: "default",
          }}
        >N</div>
        {!sidebarCollapsed && (
          <div style={{ animation: "slideInLeft 0.2s ease" }}>
            <div style={{ fontSize: "13px", fontWeight: 800, color: "#fff", whiteSpace: "nowrap", letterSpacing: "-0.02em" }}>NeuroStream</div>
            <div style={{ fontSize: "9px", color: "var(--red)", letterSpacing: "0.15em", fontWeight: 700 }}>AI PLAYER</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "4px 0", overflowY: "auto" }}>
        {NAV.map(item => {
          const active = currentPage === item.id;
          const badge  = badges[item.id];
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              title={sidebarCollapsed ? item.label : ""}
              style={{
                width: "100%", display: "flex", alignItems: "center",
                gap: "12px",
                padding: sidebarCollapsed ? "12px 0" : "11px 16px",
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                background: active ? "rgba(229,9,20,0.1)" : "transparent",
                border: "none",
                borderLeft: active ? "3px solid var(--red)" : "3px solid transparent",
                color: active ? "#fff" : "var(--text3)",
                cursor: "pointer", fontSize: "13px",
                fontWeight: active ? 600 : 400,
                transition: "all 0.15s", whiteSpace: "nowrap",
                position: "relative",
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = "#ccc"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = "var(--text3)"; e.currentTarget.style.background = "transparent"; } }}
            >
              <span style={{ fontSize: "16px", flexShrink: 0, position: "relative" }}>
                {item.icon}
                {badge && sidebarCollapsed && (
                  <span style={{ position: "absolute", top: "-5px", right: "-6px", background: "var(--red)", color: "#fff", fontSize: "8px", fontWeight: 800, width: "14px", height: "14px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {badge > 99 ? "99" : badge}
                  </span>
                )}
              </span>
              {!sidebarCollapsed && (
                <>
                  <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
                  {badge > 0 && (
                    <span style={{ background: active ? "var(--red)" : "rgba(255,255,255,0.08)", color: active ? "#fff" : "var(--text3)", fontSize: "10px", fontWeight: 700, padding: "1px 7px", borderRadius: "10px" }}>
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        style={{
          margin: "10px auto", background: "rgba(255,255,255,0.05)",
          border: "1px solid var(--border)", color: "var(--text3)",
          borderRadius: "8px", padding: "7px 12px", cursor: "pointer",
          fontSize: "11px", display: "flex", alignItems: "center", gap: "6px",
          transition: "all 0.15s", flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "var(--text3)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
      >
        {sidebarCollapsed ? "▶" : "◀"}
        {!sidebarCollapsed && <span>Collapse</span>}
      </button>
    </aside>
  );
}