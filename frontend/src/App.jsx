import { useEffect } from "react";
import { useAppStore } from "./store/useAppStore";
import Sidebar from "./components/Sidebar";
import TitleBar from "./components/TitleBar";
import VideoPlayer from "./components/VideoPlayer";
import VideoCard from "./components/VideoCard";
import VoiceAssistant from "./components/VoiceAssistant";

// ─── Page: Home ───────────────────────────────────────────────────
function HomePage() {
  const { videos, currentVideo, setCurrentVideo, openFolder, openFile, isLoading, history } = useAppStore();

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
      {/* Hero / Player */}
      {currentVideo && (
        <section style={{ marginBottom: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div style={{ width: "4px", height: "18px", background: "#e50914", borderRadius: "2px" }} />
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#fff", letterSpacing: "0.03em" }}>
              NOW PLAYING
            </h2>
          </div>
          <VideoPlayer onClose={() => useAppStore.getState().setCurrentVideo(null)} />
        </section>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "36px", flexWrap: "wrap" }}>
        <ActionBtn onClick={openFolder} primary icon="📂" loading={isLoading}>
          {isLoading ? "Scanning..." : "Open Folder"}
        </ActionBtn>
        <ActionBtn onClick={openFile} icon="🎬">Open File</ActionBtn>
        {videos.length > 0 && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px", color: "#555", fontSize: "13px" }}>
            <span>{videos.length} videos</span>
          </div>
        )}
      </div>

      {/* Continue Watching */}
      {history.length > 0 && (
        <Section title="Continue Watching" icon="⏱">
          <VideoGrid>
            {history.slice(0, 6).map(h => {
              const video = videos.find(v => v.file_path === h.file_path) || {
                id: h.id, title: h.title, url: h.file_path,
                file_path: h.file_path, duration: h.duration
              };
              return (
                <VideoCard
                  key={h.id}
                  video={video}
                  isActive={currentVideo?.file_path === h.file_path}
                  onClick={() => setCurrentVideo(video)}
                />
              );
            })}
          </VideoGrid>
        </Section>
      )}

      {/* All Videos */}
      {videos.length > 0 ? (
        <Section title="Your Library" icon="◫">
          <VideoGrid>
            {videos.map(v => (
              <VideoCard
                key={v.id}
                video={v}
                isActive={currentVideo?.id === v.id}
                onClick={() => setCurrentVideo(v)}
              />
            ))}
          </VideoGrid>
        </Section>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

// ─── Page: Library ────────────────────────────────────────────────
function LibraryPage() {
  const { videos, currentVideo, setCurrentVideo, searchResults, searchQuery } = useAppStore();
  const displayVideos = searchQuery ? searchResults : videos;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
      <Section title={searchQuery ? `Results for "${searchQuery}"` : "Full Library"} icon="◫">
        {displayVideos.length > 0 ? (
          <VideoGrid>
            {displayVideos.map(v => (
              <VideoCard
                key={v.id || v.file_path}
                video={v}
                isActive={currentVideo?.file_path === v.file_path}
                onClick={() => setCurrentVideo(v)}
              />
            ))}
          </VideoGrid>
        ) : (
          <div style={{ color: "#555", fontSize: "14px", padding: "40px 0" }}>
            {searchQuery ? "No results found." : "No videos in library. Open a folder first."}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─── Page: History ────────────────────────────────────────────────
function HistoryPage() {
  const { history, setCurrentVideo, loadHistory, videos } = useAppStore();

  useEffect(() => { loadHistory(); }, []);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
      <Section title="Continue Watching" icon="⏱">
        {history.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            {history.map(h => {
              const pct = h.duration > 0 ? (h.progress / h.duration) * 100 : 0;
              const video = videos.find(v => v.file_path === h.file_path) || {
                id: h.id, title: h.title, url: h.file_path,
                file_path: h.file_path, duration: h.duration
              };
              return (
                <div
                  key={h.id}
                  style={{
                    display: "flex", alignItems: "center", gap: "16px",
                    padding: "14px 16px", borderRadius: "10px",
                    background: "rgba(255,255,255,0.03)",
                    cursor: "pointer", transition: "background 0.15s",
                    marginBottom: "4px",
                  }}
                  onClick={() => setCurrentVideo(video)}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                >
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "8px",
                    background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "18px", flexShrink: 0,
                  }}>🎬</div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#fff", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {h.title}
                    </div>
                    <div style={{ height: "3px", background: "rgba(255,255,255,0.1)", borderRadius: "2px" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "#e50914", borderRadius: "2px" }} />
                    </div>
                  </div>
                  <div style={{ fontSize: "12px", color: "#555", flexShrink: 0 }}>
                    {Math.round(pct)}%
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: "#555", fontSize: "14px", padding: "40px 0" }}>No watch history yet.</div>
        )}
      </Section>
    </div>
  );
}

// ─── Page: Settings ───────────────────────────────────────────────
function SettingsPage() {
  const { volume, setVolume, isMuted, setMuted } = useAppStore();
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
      <Section title="Settings" icon="◈">
        <div style={{ maxWidth: "480px", display: "flex", flexDirection: "column", gap: "24px" }}>
          <SettingRow label="Default Volume" hint="Controls startup volume">
            <input
              type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume}
              onChange={e => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
              style={{ width: "200px", accentColor: "#e50914" }}
            />
            <span style={{ color: "#888", fontSize: "13px", width: "40px" }}>{Math.round(volume * 100)}%</span>
          </SettingRow>

          <SettingRow label="Mute on Start" hint="Start all videos muted">
            <Toggle value={isMuted} onChange={() => setMuted(!isMuted)} />
          </SettingRow>

          <SettingRow label="Keyboard Shortcuts" hint="">
            <div style={{ fontSize: "12px", color: "#666", lineHeight: "2" }}>
              Space / K — Play/Pause<br />
              ← / J — Back 10s &nbsp;&nbsp; → / L — Forward 10s<br />
              ↑ / ↓ — Volume up/down<br />
              M — Toggle mute &nbsp;&nbsp; F — Fullscreen<br />
              , / . — Decrease/Increase speed<br />
              Esc — Exit fullscreen or close player
            </div>
          </SettingRow>

          <SettingRow label="Version" hint="">
            <span style={{ color: "#555", fontSize: "13px" }}>NeuroStream AI v2.0.0</span>
          </SettingRow>
        </div>
      </Section>
    </div>
  );
}

// ─── Shared UI ─────────────────────────────────────────────────────
function Section({ title, icon, children }) {
  return (
    <section style={{ marginBottom: "40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
        <div style={{ width: "4px", height: "18px", background: "#e50914", borderRadius: "2px" }} />
        <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#fff", letterSpacing: "0.03em" }}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function VideoGrid({ children }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
      gap: "16px",
    }}>
      {children}
    </div>
  );
}

function ActionBtn({ children, onClick, primary, icon, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: "10px 22px",
        background: primary ? "linear-gradient(135deg, #e50914, #c40812)" : "rgba(255,255,255,0.06)",
        border: primary ? "none" : "1px solid rgba(255,255,255,0.1)",
        color: "#fff", borderRadius: "10px",
        fontSize: "13px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", gap: "8px",
        transition: "all 0.2s",
        boxShadow: primary ? "0 4px 20px rgba(229,9,20,0.3)" : "none",
        opacity: loading ? 0.6 : 1,
      }}
    >
      <span>{icon}</span> {children}
    </button>
  );
}

function EmptyState() {
  const { openFolder } = useAppStore();
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "80px 40px", textAlign: "center",
      background: "rgba(255,255,255,0.02)", borderRadius: "16px",
      border: "1px dashed rgba(255,255,255,0.08)",
    }}>
      <div style={{ fontSize: "52px", marginBottom: "20px", opacity: 0.3 }}>🎬</div>
      <h2 style={{ margin: "0 0 8px", fontSize: "20px", color: "#fff", fontWeight: 700 }}>Your library is empty</h2>
      <p style={{ margin: "0 0 24px", color: "#555", fontSize: "14px", maxWidth: "300px" }}>
        Open a folder to start watching your local videos with full metadata and streaming.
      </p>
      <button
        onClick={openFolder}
        style={{
          padding: "12px 28px", background: "#e50914", border: "none", color: "#fff",
          borderRadius: "10px", fontSize: "14px", fontWeight: 700, cursor: "pointer",
          boxShadow: "0 4px 20px rgba(229,9,20,0.4)",
        }}
      >
        📂 Open Folder
      </button>
    </div>
  );
}

function SettingRow({ label, hint, children }) {
  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#fff", marginBottom: "2px" }}>{label}</div>
          {hint && <div style={{ fontSize: "12px", color: "#555" }}>{hint}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>{children}</div>
      </div>
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: "44px", height: "24px", borderRadius: "12px",
        background: value ? "#e50914" : "rgba(255,255,255,0.1)",
        cursor: "pointer", position: "relative", transition: "background 0.2s",
      }}
    >
      <div style={{
        position: "absolute", top: "3px", left: value ? "23px" : "3px",
        width: "18px", height: "18px", borderRadius: "50%",
        background: "#fff", transition: "left 0.2s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
      }} />
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────
export default function App() {
  const { currentPage, loadHistory } = useAppStore();

  useEffect(() => { loadHistory(); }, []);

  const pages = {
    home: <HomePage />,
    library: <LibraryPage />,
    history: <HistoryPage />,
    settings: <SettingsPage />,
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100vh", background: "#0a0a0a", color: "#fff",
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      overflow: "hidden",
    }}>
      {/* Top bar */}
      <TitleBar />

      {/* Main layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar />
        {pages[currentPage] || <HomePage />}
      </div>

      {/* Voice assistant FAB */}
      <VoiceAssistant />
    </div>
  );
}