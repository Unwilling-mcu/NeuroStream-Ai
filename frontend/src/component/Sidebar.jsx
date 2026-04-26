import { useAppStore } from "../store/useAppStore";

const NAV = [
  { id: "home",     icon: "⬡",  label: "Home",             hint: "Home" },
  { id: "library",  icon: "◫",  label: "Library",          hint: "Your Library" },
  { id: "history",  icon: "⏱",  label: "Continue",         hint: "Continue Watching" },
  { id: "settings", icon: "◈",  label: "Settings",         hint: "Settings" },
];

export default function Sidebar() {
  const {
    currentPage, setPage,
    sidebarCollapsed, setSidebarCollapsed,
    videos, history,
  } = useAppStore();

  const w = sidebarCollapsed ? "64px" : "200px";

  const badges = {
    library: videos.length || null,
    history: history.length || null,
  };

  return (
    <aside style={{
      width: w, minWidth: w,
      height: "100vh",
      background: "rgba(8,8,8,0.98)",
      backdropFilter: "blur(24px)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      padding: "0",
      transition: "width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1)",
      overflow: "hidden", flexShrink: 0,
      position: "relative", zIndex: 100,
    }}>

      {/* Logo */}
      <div style={{
        display: "flex", alignItems: "center",
        gap: "10px",
        padding: sidebarCollapsed ? "20px 0" : "20px 18px",
        justifyContent: sidebarCollapsed ? "center" : "flex-start",
        borderBottom: "1px solid var(--border)",
        marginBottom: "8px",
        flexShrink: 0,
      }}>
        <div style={{
          width: "32px", height: "32px", flexShrink: 0,
          background: "linear-gradient(135deg, #e50914 0%, #ff4500 100%)",
          borderRadius: "10px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "15px", fontWeight: 900, color: "#fff",
          boxShadow: "0 4px 16px rgba(229,9,20,0.45)",
          letterSpacing: "-0.05em",
        }}>N</div>

        {!sidebarCollapsed && (
          <div style={{ animation: "slideInLeft 0.2s ease", overflow: "hidden" }}>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "#fff", whiteSpace: "nowrap", letterSpacing: "-0.02em" }}>
              NeuroStream
            </div>
            <div style={{ fontSize: "9px", color: "var(--red)", letterSpacing: "0.15em", fontWeight: 700 }}>
              AI PLAYER
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "4px 0" }}>
        {NAV.map(item => {
          const active = currentPage === item.id;
          const badge = badges[item.id];
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              title={sidebarCollapsed ? item.hint : ""}
              style={{
                width: "100%",
                display: "flex", alignItems: "center",
                gap: "12px",
                padding: sidebarCollapsed ? "12px 0" : "11px 18px",
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                background: active ? "rgba(229,9,20,0.1)" : "transparent",
                border: "none",
                borderLeft: active ? "3px solid var(--red)" : "3px solid transparent",
                color: active ? "#fff" : "var(--text3)",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: active ? 600 : 400,
                transition: "all 0.15s",
                letterSpacing: "0.01em",
                whiteSpace: "nowrap",
                position: "relative",
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = "#ccc"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = "var(--text3)"; e.currentTarget.style.background = "transparent"; } }}
            >
              <span style={{ fontSize: "17px", flexShrink: 0, position: "relative" }}>
                {item.icon}
                {badge && sidebarCollapsed && (
                  <span style={{
                    position: "absolute", top: "-5px", right: "-6px",
                    background: "var(--red)", color: "#fff",
                    fontSize: "8px", fontWeight: 800,
                    width: "14px", height: "14px", borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{badge > 99 ? "99" : badge}</span>
                )}
              </span>

              {!sidebarCollapsed && (
                <>
                  <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
                  {badge > 0 && (
                    <span style={{
                      background: active ? "var(--red)" : "rgba(255,255,255,0.1)",
                      color: active ? "#fff" : "var(--text3)",
                      fontSize: "10px", fontWeight: 700,
                      padding: "1px 7px", borderRadius: "10px",
                      minWidth: "20px", textAlign: "center",
                    }}>{badge > 99 ? "99+" : badge}</span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        style={{
          margin: "12px auto",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid var(--border)",
          color: "var(--text3)", borderRadius: "8px",
          padding: "7px 12px", cursor: "pointer",
          fontSize: "11px", display: "flex",
          alignItems: "center", gap: "6px",
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