import { useAppStore } from "../store/useAppStore";

const NAV_ITEMS = [
  { id: "home",    icon: "⬡", label: "Home" },
  { id: "library", icon: "◫", label: "Library" },
  { id: "history", icon: "⏱", label: "Continue" },
  { id: "settings",icon: "◈", label: "Settings" },
];

export default function Sidebar() {
  const { currentPage, setPage, sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  const w = sidebarCollapsed ? "68px" : "200px";

  return (
    <div style={{
      width: w,
      minWidth: w,
      height: "100vh",
      background: "rgba(10,10,10,0.95)",
      backdropFilter: "blur(20px)",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      display: "flex",
      flexDirection: "column",
      padding: "20px 0",
      transition: "width 0.25s ease, min-width 0.25s ease",
      overflow: "hidden",
      flexShrink: 0,
      position: "relative",
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: sidebarCollapsed ? "0 16px 24px" : "0 20px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        marginBottom: "16px",
        overflow: "hidden",
      }}>
        <div style={{
          width: "34px", height: "34px", flexShrink: 0,
          background: "linear-gradient(135deg, #e50914, #ff6b35)",
          borderRadius: "10px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "16px", fontWeight: 900, color: "#fff",
          boxShadow: "0 4px 16px rgba(229,9,20,0.4)",
        }}>N</div>
        {!sidebarCollapsed && (
          <div>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
              NeuroStream
            </div>
            <div style={{ fontSize: "10px", color: "#e50914", letterSpacing: "0.1em", fontWeight: 600 }}>AI</div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1 }}>
        {NAV_ITEMS.map(item => {
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center",
                gap: "12px",
                padding: sidebarCollapsed ? "12px 0" : "12px 20px",
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                background: active ? "rgba(229,9,20,0.12)" : "transparent",
                border: "none", borderLeft: active ? "3px solid #e50914" : "3px solid transparent",
                color: active ? "#fff" : "#666",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: active ? 600 : 400,
                transition: "all 0.15s",
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = "#bbb"; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = "#666"; }}
            >
              <span style={{ fontSize: "18px", flexShrink: 0 }}>{item.icon}</span>
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        style={{
          margin: "16px auto 0",
          background: "rgba(255,255,255,0.06)",
          border: "none", color: "#666",
          borderRadius: "8px",
          padding: "8px 12px",
          cursor: "pointer",
          fontSize: "12px",
          display: "block",
          transition: "all 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.color = "#fff"}
        onMouseLeave={e => e.currentTarget.style.color = "#666"}
      >
        {sidebarCollapsed ? "▶" : "◀"}
      </button>
    </div>
  );
}