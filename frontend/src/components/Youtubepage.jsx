import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "../store/useAppStore";

const API = "http://localhost:5000";

function msToTime(sec = 0) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function TrackRow({ track, index, isActive, isPlaying, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "8px 10px", borderRadius: "9px", cursor: "pointer",
        background: isActive ? "rgba(229,9,20,0.1)" : hov ? "rgba(255,255,255,0.05)" : "transparent",
        border: `1px solid ${isActive ? "rgba(229,9,20,0.25)" : "transparent"}`,
        transition: "all 0.12s", marginBottom: "2px",
      }}
    >
      <div style={{ width: "24px", textAlign: "center", flexShrink: 0, fontSize: "12px", color: isActive ? "#e50914" : "rgba(255,255,255,0.35)" }}>
        {isPlaying ? "▶" : isActive ? "•" : index}
      </div>
      {track.thumbnail
        ? <img src={track.thumbnail} alt="" style={{ width: "54px", height: "36px", borderRadius: "5px", objectFit: "cover", flexShrink: 0 }} />
        : <div style={{ width: "54px", height: "36px", borderRadius: "5px", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>🎵</div>
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: isActive ? 600 : 400, color: isActive ? "#fff" : "rgba(255,255,255,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {track.title}
        </div>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {track.channel}{track.views ? ` · ${track.views}` : ""}
        </div>
      </div>
      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>
        {track.duration ? msToTime(track.duration) : "--:--"}
      </span>
    </div>
  );
}

export default function YoutubePage() {
  const { ytTrack, ytPlaying, setYtTrack, setYtStreamUrl, setYtQueue, ytQueue, ytQueueIdx } = useAppStore();

  const [query,         setQuery]         = useState("");
  const [results,       setResults]       = useState([]);
  const [trending,      setTrending]      = useState([]);
  const [view,          setView]          = useState("trending");
  const [loading,       setLoading]       = useState(false);
  const [streamLoading, setStreamLoading] = useState(false);
  const [error,         setError]         = useState(null);

  // Load trending on mount
  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/yt/trending`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => { setTrending(d.tracks || []); })
      .catch(e => setError(`Could not load trending: ${e}`))
      .finally(() => setLoading(false));
  }, []);

  const doSearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API}/api/yt/search?q=${encodeURIComponent(query)}`);
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setResults(d.tracks || []);
      setView("results");
    } catch (e) { setError(`Search failed: ${e.message}`); }
    finally { setLoading(false); }
  };

  const playTrack = useCallback(async (track, list, idx) => {
    setStreamLoading(true);
    setError(null);
    setYtTrack(track);
    setYtStreamUrl(null);
    setYtQueue(list, idx);
    try {
      const r = await fetch(`${API}/api/yt/stream-url?id=${encodeURIComponent(track.id)}`);
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setYtStreamUrl(d.url);
    } catch (e) {
      setError(`Playback failed: ${e.message}`);
      setYtTrack(null);
    } finally { setStreamLoading(false); }
  }, [setYtTrack, setYtStreamUrl, setYtQueue]);

  const list = view === "results" ? results : trending;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`@keyframes ns-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Top bar */}
      <div style={{ padding: "13px 24px", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "linear-gradient(135deg,#ff0000,#cc0000)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>▶</div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff", lineHeight: 1 }}>YouTube Music</div>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em" }}>FREE · NO LOGIN</div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", gap: "7px", maxWidth: "480px" }}>
          <input
            type="text" placeholder="Search songs, artists, albums…"
            value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doSearch()}
            style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: "8px", padding: "8px 13px", fontSize: "13px", outline: "none" }}
          />
          <button onClick={doSearch} disabled={loading}
            style={{ padding: "8px 16px", background: "linear-gradient(135deg,#e50914,#c40812)", border: "none", color: "#fff", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 700, opacity: loading ? 0.6 : 1 }}>
            {loading ? "…" : "Search"}
          </button>
        </div>

        {view === "results" && (
          <button onClick={() => { setView("trending"); setQuery(""); }}
            style={{ padding: "6px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)", borderRadius: "8px", cursor: "pointer", fontSize: "11px", flexShrink: 0 }}>
            ← Trending
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ margin: "10px 24px 0", padding: "10px 14px", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: "8px", fontSize: "12px", color: "#f87171", display: "flex", gap: "10px", alignItems: "center" }}>
          <span style={{ flex: 1 }}>⚠ {error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "15px" }}>✕</button>
        </div>
      )}

      {/* Buffering */}
      {streamLoading && (
        <div style={{ margin: "10px 24px 0", padding: "10px 14px", background: "rgba(229,9,20,0.06)", border: "1px solid rgba(229,9,20,0.2)", borderRadius: "8px", fontSize: "12px", color: "rgba(229,9,20,0.8)", display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ width: "14px", height: "14px", border: "2px solid rgba(229,9,20,0.2)", borderTopColor: "#e50914", borderRadius: "50%", animation: "ns-spin 0.7s linear infinite", flexShrink: 0 }} />
          Fetching stream for <strong style={{ color: "#fff", marginLeft: 4 }}>{ytTrack?.title}</strong>…
        </div>
      )}

      {/* Track list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 24px" }}>
        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.09em", marginBottom: "14px" }}>
          {view === "trending"
            ? `🔥 TRENDING — ${trending.length} TRACKS`
            : `🔍 "${query.toUpperCase()}" — ${results.length} TRACKS`}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "48px", color: "rgba(255,255,255,0.3)" }}>
            <div style={{ width: "22px", height: "22px", margin: "0 auto 12px", border: "2px solid rgba(229,9,20,0.15)", borderTopColor: "#e50914", borderRadius: "50%", animation: "ns-spin 0.7s linear infinite" }} />
            Loading…
          </div>
        )}

        {!loading && list.map((track, i) => (
          <TrackRow key={track.id} track={track} index={i + 1}
            isActive={ytTrack?.id === track.id}
            isPlaying={ytPlaying && ytTrack?.id === track.id}
            onClick={() => playTrack(track, list, i)}
          />
        ))}

        {!loading && list.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>
            {view === "trending" ? "Could not load trending — search for music above." : "No results found."}
          </div>
        )}
      </div>
    </div>
  );
}