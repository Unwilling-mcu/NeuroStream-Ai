import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore } from "../store/useAppStore";

const API = "http://localhost:5000";

// ─── Playlist storage ─────────────────────────────────────────────
const PL_KEY = "ns_yt_playlists";
const loadPlaylists = () => { try { return JSON.parse(localStorage.getItem(PL_KEY) || "{}"); } catch { return {}; } };
const savePlaylists = (p) => { try { localStorage.setItem(PL_KEY, JSON.stringify(p)); } catch {} };

function msToTime(sec = 0) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ─── TrackRow ─────────────────────────────────────────────────────
function TrackRow({ track, index, isActive, isPlaying, onClick, onAdd, onWatch, playlists, inPlaylist }) {
  const [hov, setHov]       = useState(false);
  const [showMenu, setMenu] = useState(false);
  const menuRef             = useRef(null);
  const btnRef              = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!showMenu) return;
    const close = (e) => { if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setMenu(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showMenu]);

  const openMenu = (e) => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const top  = rect.bottom + 4 > window.innerHeight - 180 ? rect.top - 180 : rect.bottom + 4;
      const left = rect.right - 190 < 0 ? rect.left : rect.right - 190;
      setMenuPos({ top, left });
    }
    setMenu(s => !s);
  };

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display:"flex", alignItems:"center", gap:"10px", padding:"7px 10px", borderRadius:"9px",
        background: isActive ? "rgba(229,9,20,0.1)" : hov ? "rgba(255,255,255,0.05)" : "transparent",
        border:`1px solid ${isActive?"rgba(229,9,20,0.25)":"transparent"}`, transition:"all 0.12s", marginBottom:"2px", position:"relative" }}>

      <div onClick={onClick} style={{ width:"24px", textAlign:"center", flexShrink:0, fontSize:"12px", color:isActive?"#e50914":"rgba(255,255,255,0.35)", cursor:"pointer" }}>
        {isPlaying ? "▶" : isActive ? "•" : index}
      </div>

      <div onClick={onClick} style={{ cursor:"pointer", flexShrink:0 }}>
        {track.thumbnail
          ? <img src={track.thumbnail} alt="" style={{ width:"52px", height:"34px", borderRadius:"5px", objectFit:"cover", display:"block" }}/>
          : <div style={{ width:"52px", height:"34px", borderRadius:"5px", background:"rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px" }}>🎵</div>
        }
      </div>

      <div onClick={onClick} style={{ flex:1, minWidth:0, cursor:"pointer" }}>
        <div style={{ fontSize:"13px", fontWeight:isActive?600:400, color:isActive?"#fff":"rgba(255,255,255,0.9)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{track.title}</div>
        <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.4)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {track.channel}{track.views ? ` · ${track.views}` : ""}
        </div>
      </div>

      <span style={{ fontSize:"11px", color:"rgba(255,255,255,0.35)", flexShrink:0 }}>
        {track.duration ? msToTime(track.duration) : "--:--"}
      </span>

      {(hov || showMenu) && (
        <div style={{ display:"flex", gap:"4px", flexShrink:0 }}>
          {onWatch && (
            <button onClick={onWatch} title="Watch in room"
              style={{ background:"rgba(29,185,84,0.1)", border:"1px solid rgba(29,185,84,0.2)", color:"#3ddc84", borderRadius:"6px", padding:"3px 8px", cursor:"pointer", fontSize:"11px" }}>
              👥
            </button>
          )}
          <button ref={btnRef} onClick={openMenu} title="Add to playlist"
            style={{ background:showMenu?"rgba(229,9,20,0.15)":"rgba(255,255,255,0.08)", border:`1px solid ${showMenu?"rgba(229,9,20,0.3)":"rgba(255,255,255,0.1)"}`, color:showMenu?"#e50914":"#fff", borderRadius:"6px", padding:"3px 8px", cursor:"pointer", fontSize:"13px" }}>
            ➕
          </button>
        </div>
      )}

      {showMenu && (
        <div ref={menuRef} style={{ position:"fixed", top:menuPos.top, left:menuPos.left, zIndex:9999, background:"rgba(14,14,14,0.98)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:"10px", padding:"6px", minWidth:"190px", boxShadow:"0 12px 40px rgba(0,0,0,0.9)", backdropFilter:"blur(20px)" }}>
          <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.3)", padding:"4px 8px 6px", letterSpacing:"0.07em" }}>ADD TO PLAYLIST</div>
          {Object.keys(playlists).length === 0
            ? <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.3)", padding:"6px 10px" }}>No playlists — create one first</div>
            : Object.keys(playlists).map(name => (
              <div key={name} onClick={() => { onAdd(name); setMenu(false); }}
                style={{ fontSize:"12px", color:"#fff", padding:"7px 10px", borderRadius:"6px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between" }}
                onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.06)"}
                onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                <span>🎵 {name}</span>
                {inPlaylist === name && <span style={{ fontSize:"10px", color:"#3ddc84" }}>✓</span>}
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export default function YoutubePage() {
  const {
    ytTrack, ytPlaying,
    setYtTrack, setYtStreamUrl, setYtQueue,
    wtJoined, wtIsHost, wtRoomId,
    setWtRoomVideo, addWtLog,
  } = useAppStore();

  const [query,         setQuery]         = useState("");
  const [results,       setResults]       = useState([]);
  const [trending,      setTrending]      = useState([]);
  const [view,          setView]          = useState("trending");
  const [loading,       setLoading]       = useState(false);
  const [streamLoading, setStreamLoading] = useState(false);
  const [error,         setError]         = useState(null);

  const [playlists,    setPlaylists]    = useState(loadPlaylists);
  const [activePl,     setActivePl]     = useState(null);
  const [newPlName,    setNewPlName]    = useState("");
  const [showPlCreate, setShowPlCreate] = useState(false);
  const [renamingPl,   setRenamingPl]   = useState(null);
  const [renameVal,    setRenameVal]    = useState("");

  const [netUrl,   setNetUrl]   = useState("");
  const [netTitle, setNetTitle] = useState("");

  const persistPl = (p) => { setPlaylists(p); savePlaylists(p); };

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/yt/trending`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => setTrending(d.tracks || []))
      .catch(e => setError(`Could not load trending: ${e}`))
      .finally(() => setLoading(false));
  }, []);

  const doSearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API}/api/yt/search?q=${encodeURIComponent(query)}`);
      if (!r.ok) throw new Error(await r.text());
      setResults((await r.json()).tracks || []);
      setView("results");
    } catch (e) { setError(`Search failed: ${e.message}`); }
    finally { setLoading(false); }
  };

  const playTrack = useCallback(async (track, list, idx) => {
    setStreamLoading(true); setError(null);
    setYtTrack(track); setYtStreamUrl(null);
    setYtQueue(list, idx);
    try {
      const r = await fetch(`${API}/api/yt/stream-url?id=${encodeURIComponent(track.id)}`);
      if (!r.ok) throw new Error(await r.text());
      setYtStreamUrl((await r.json()).url);
    } catch (e) { setError(`Playback failed: ${e.message}`); setYtTrack(null); }
    finally { setStreamLoading(false); }
  }, [setYtTrack, setYtStreamUrl, setYtQueue]);

  const watchInRoom = useCallback(async (track) => {
    if (!wtJoined || !wtIsHost) { setError("Join a Watch Together room as host first."); return; }
    setStreamLoading(true);
    try {
      const r = await fetch(`${API}/api/yt/stream-url?id=${encodeURIComponent(track.id)}`);
      if (!r.ok) throw new Error(await r.text());
      const { url } = await r.json();
      const rv = { id: track.id, title: track.title, url, streamUrl: url, thumbnail: track.thumbnail, file_path: null };
      setWtRoomVideo(rv);
      window.__wtSend?.({ type:"video", roomId:wtRoomId, streamUrl:url, title:track.title, videoPath:null });
      addWtLog("▶ YT: " + track.title);
      const v = document.getElementById("wt-video");
      if (v) { v.src = url; v.currentTime = 0; v.play(); }
    } catch (e) { setError(`Watch Together failed: ${e.message}`); }
    finally { setStreamLoading(false); }
  }, [wtJoined, wtIsHost, wtRoomId, setWtRoomVideo, addWtLog]);

  const watchNetInRoom = () => {
    if (!netUrl.trim()) return;
    if (!wtJoined || !wtIsHost) { setError("Join a Watch Together room as host first."); return; }
    const url   = netUrl.trim();
    const title = netTitle.trim() || "Network stream";
    const rv = { id: url, title, url, streamUrl: url, thumbnail: null, file_path: null };
    setWtRoomVideo(rv);
    window.__wtSend?.({ type:"video", roomId:wtRoomId, streamUrl:url, title, videoPath:null });
    addWtLog("🌐 " + title);
    const v = document.getElementById("wt-video");
    if (v) { v.src = url; v.currentTime = 0; v.play(); }
  };

  const createPl = () => {
    const n = newPlName.trim();
    if (!n || playlists[n]) return;
    persistPl({ ...playlists, [n]: [] });
    setNewPlName(""); setShowPlCreate(false);
    setActivePl(n); setView("playlist");
  };

  const deletePl = (n) => {
    const p = { ...playlists }; delete p[n];
    persistPl(p);
    if (activePl === n) { setActivePl(null); setView("trending"); }
  };

  const renamePl = () => {
    const nv = renameVal.trim();
    if (!nv || (nv !== renamingPl && playlists[nv])) return;
    const p = { ...playlists, [nv]: playlists[renamingPl] };
    delete p[renamingPl];
    persistPl(p);
    if (activePl === renamingPl) setActivePl(nv);
    setRenamingPl(null); setRenameVal("");
  };

  const addToPlaylist = (plName, track) => {
    if (!playlists[plName] || playlists[plName].find(t => t.id === track.id)) return;
    persistPl({ ...playlists, [plName]: [...playlists[plName], track] });
  };

  const removeFromPl = (plName, id) => persistPl({ ...playlists, [plName]: playlists[plName].filter(t => t.id !== id) });

  const movePl = (plName, idx, dir) => {
    const arr = [...playlists[plName]]; const ni = idx + dir;
    if (ni < 0 || ni >= arr.length) return;
    [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
    persistPl({ ...playlists, [plName]: arr });
  };

  const trackInPl = (track) => Object.entries(playlists).find(([, ts]) => ts.find(t => t.id === track.id))?.[0];
  const currentList = view === "results" ? results : view === "playlist" && activePl ? (playlists[activePl] || []) : trending;

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{`@keyframes ns-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Top bar */}
      <div style={{ padding:"11px 20px", display:"flex", alignItems:"center", gap:"8px", flexShrink:0, borderBottom:"1px solid rgba(255,255,255,0.06)", flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", flexShrink:0 }}>
          <div style={{ width:"28px", height:"28px", borderRadius:"7px", background:"linear-gradient(135deg,#ff0000,#cc0000)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px" }}>▶</div>
          <div>
            <div style={{ fontSize:"13px", fontWeight:700, color:"#fff", lineHeight:1 }}>YouTube Music</div>
            <div style={{ fontSize:"9px", color:"rgba(255,255,255,0.35)", letterSpacing:"0.06em" }}>FREE · NO LOGIN</div>
          </div>
        </div>

        <div style={{ flex:1, display:"flex", gap:"7px", maxWidth:"400px" }}>
          <input type="text" placeholder="Search songs, artists…" value={query}
            onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key==="Enter" && doSearch()}
            style={{ flex:1, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", borderRadius:"8px", padding:"7px 12px", fontSize:"13px", outline:"none" }}/>
          <button onClick={doSearch} disabled={loading}
            style={{ padding:"7px 14px", background:"linear-gradient(135deg,#e50914,#c40812)", border:"none", color:"#fff", borderRadius:"8px", cursor:"pointer", fontSize:"12px", fontWeight:700, opacity:loading?0.6:1 }}>
            {loading ? "…" : "Search"}
          </button>
        </div>

        {/* Nav tabs */}
        {[
          { id:"trending", label:"🔥 Trending" },
          { id:"results",  label:`🔍 Results`, hide: results.length===0 },
          { id:"network",  label:"🌐 Network URL" },
        ].filter(t => !t.hide).map(t => (
          <button key={t.id} onClick={() => setView(t.id)}
            style={{ padding:"5px 10px", background:view===t.id?"rgba(229,9,20,0.15)":"rgba(255,255,255,0.05)", border:`1px solid ${view===t.id?"rgba(229,9,20,0.3)":"rgba(255,255,255,0.1)"}`, color:view===t.id?"#e50914":"rgba(255,255,255,0.5)", borderRadius:"7px", cursor:"pointer", fontSize:"11px", fontWeight:view===t.id?700:400, flexShrink:0 }}>
            {t.label}
          </button>
        ))}

        {/* Playlist tabs */}
        {Object.keys(playlists).map(name => (
          <button key={name} onClick={() => { setActivePl(name); setView("playlist"); }}
            style={{ padding:"5px 10px", background:view==="playlist"&&activePl===name?"rgba(29,185,84,0.15)":"rgba(255,255,255,0.05)", border:`1px solid ${view==="playlist"&&activePl===name?"rgba(29,185,84,0.3)":"rgba(255,255,255,0.1)"}`, color:view==="playlist"&&activePl===name?"#3ddc84":"rgba(255,255,255,0.5)", borderRadius:"7px", cursor:"pointer", fontSize:"11px", display:"flex", alignItems:"center", gap:"5px", flexShrink:0 }}>
            🎵 {name}
            <span onClick={e => { e.stopPropagation(); deletePl(name); }} style={{ fontSize:"10px", color:"rgba(255,255,255,0.3)" }}>✕</span>
          </button>
        ))}

        {!showPlCreate
          ? <button onClick={() => setShowPlCreate(true)}
              style={{ padding:"5px 10px", background:"rgba(255,255,255,0.04)", border:"1px dashed rgba(255,255,255,0.15)", color:"rgba(255,255,255,0.4)", borderRadius:"7px", cursor:"pointer", fontSize:"11px", flexShrink:0 }}>
              + Playlist
            </button>
          : <div style={{ display:"flex", gap:"4px" }}>
              <input autoFocus value={newPlName} onChange={e => setNewPlName(e.target.value)}
                onKeyDown={e => { if(e.key==="Enter") createPl(); if(e.key==="Escape") setShowPlCreate(false); }}
                placeholder="Name…"
                style={{ width:"110px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(29,185,84,0.3)", color:"#fff", borderRadius:"7px", padding:"4px 8px", fontSize:"11px", outline:"none" }}/>
              <button onClick={createPl} style={{ padding:"4px 8px", background:"rgba(29,185,84,0.15)", border:"1px solid rgba(29,185,84,0.3)", color:"#3ddc84", borderRadius:"7px", cursor:"pointer", fontSize:"11px" }}>✓</button>
              <button onClick={() => setShowPlCreate(false)} style={{ padding:"4px 8px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.4)", borderRadius:"7px", cursor:"pointer", fontSize:"11px" }}>✕</button>
            </div>
        }
      </div>

      {/* Banners */}
      {error && (
        <div style={{ margin:"8px 20px 0", padding:"9px 13px", background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.25)", borderRadius:"8px", fontSize:"12px", color:"#f87171", display:"flex", gap:"10px", alignItems:"center" }}>
          <span style={{ flex:1 }}>⚠ {error}</span>
          <button onClick={() => setError(null)} style={{ background:"none", border:"none", color:"#f87171", cursor:"pointer", fontSize:"14px" }}>✕</button>
        </div>
      )}
      {streamLoading && (
        <div style={{ margin:"8px 20px 0", padding:"9px 13px", background:"rgba(229,9,20,0.06)", border:"1px solid rgba(229,9,20,0.2)", borderRadius:"8px", fontSize:"12px", color:"rgba(229,9,20,0.8)", display:"flex", gap:"8px", alignItems:"center" }}>
          <div style={{ width:"13px", height:"13px", border:"2px solid rgba(229,9,20,0.2)", borderTopColor:"#e50914", borderRadius:"50%", animation:"ns-spin 0.7s linear infinite", flexShrink:0 }}/>
          Fetching stream…
        </div>
      )}
      {wtJoined && wtIsHost && view !== "network" && (
        <div style={{ margin:"8px 20px 0", padding:"8px 13px", background:"rgba(29,185,84,0.07)", border:"1px solid rgba(29,185,84,0.2)", borderRadius:"8px", fontSize:"12px", color:"rgba(29,185,84,0.9)", display:"flex", alignItems:"center", gap:"8px" }}>
          <span>👥</span>
          <span style={{ flex:1 }}>Hosting room <strong style={{ color:"#fff" }}>{wtRoomId}</strong> — click 👥 on any track to stream it to your room</span>
        </div>
      )}

      {/* Network URL panel */}
      {view === "network" && (
        <div style={{ margin:"16px 20px 0", padding:"18px 20px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"12px" }}>
          <div style={{ fontSize:"14px", fontWeight:700, color:"#fff", marginBottom:"4px" }}>🌐 Network / Direct URL</div>
          <div style={{ fontSize:"12px", color:"rgba(255,255,255,0.4)", marginBottom:"16px", lineHeight:1.6 }}>
            Paste any direct media URL (MP4, M3U8, WEBM…) to play it or stream to your Watch Together room.
          </div>
          <input type="text" placeholder="https://example.com/stream.m3u8 or video.mp4…"
            value={netUrl} onChange={e => setNetUrl(e.target.value)}
            style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", borderRadius:"9px", padding:"10px 14px", fontSize:"13px", outline:"none", boxSizing:"border-box", marginBottom:"10px" }}/>
          <input type="text" placeholder="Title (optional)…" value={netTitle} onChange={e => setNetTitle(e.target.value)}
            style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", borderRadius:"9px", padding:"10px 14px", fontSize:"13px", outline:"none", boxSizing:"border-box", marginBottom:"14px" }}/>
          <div style={{ display:"flex", gap:"10px" }}>
            <button onClick={() => {
              if (!netUrl.trim()) return;
              const url = netUrl.trim();
              const title = netTitle.trim() || "Network stream";
              setYtTrack({ id:url, title, thumbnail:null, channel:"Network URL", duration:0 });
              setYtStreamUrl(url);
            }} style={{ flex:1, padding:"10px", background:"linear-gradient(135deg,#e50914,#c40812)", border:"none", color:"#fff", borderRadius:"9px", cursor:"pointer", fontSize:"13px", fontWeight:700 }}>
              ▶ Play Here
            </button>
            {wtJoined && wtIsHost && (
              <button onClick={watchNetInRoom}
                style={{ flex:1, padding:"10px", background:"rgba(29,185,84,0.12)", border:"1px solid rgba(29,185,84,0.25)", color:"#3ddc84", borderRadius:"9px", cursor:"pointer", fontSize:"13px", fontWeight:700 }}>
                👥 Stream to Room
              </button>
            )}
          </div>
        </div>
      )}

      {/* Track list */}
      {view !== "network" && (
        <div style={{ flex:1, overflowY:"auto", padding:"12px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px" }}>
            <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.3)", letterSpacing:"0.09em" }}>
              {view==="trending" && `🔥 TRENDING — ${trending.length} TRACKS`}
              {view==="results"  && `🔍 "${query.toUpperCase()}" — ${results.length} TRACKS`}
              {view==="playlist" && activePl && renamingPl !== activePl && `🎵 ${activePl.toUpperCase()} — ${(playlists[activePl]||[]).length} TRACKS`}
            </div>
            {view==="playlist" && activePl && (
              <div style={{ display:"flex", gap:"6px" }}>
                {renamingPl === activePl ? (
                  <>
                    <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                      onKeyDown={e => { if(e.key==="Enter") renamePl(); if(e.key==="Escape") setRenamingPl(null); }}
                      style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(29,185,84,0.3)", color:"#fff", borderRadius:"6px", padding:"3px 8px", fontSize:"11px", outline:"none", width:"110px" }}/>
                    <button onClick={renamePl} style={{ padding:"3px 8px", background:"rgba(29,185,84,0.15)", border:"1px solid rgba(29,185,84,0.3)", color:"#3ddc84", borderRadius:"6px", cursor:"pointer", fontSize:"11px" }}>✓</button>
                    <button onClick={() => setRenamingPl(null)} style={{ padding:"3px 8px", background:"rgba(255,255,255,0.05)", border:"none", color:"rgba(255,255,255,0.4)", borderRadius:"6px", cursor:"pointer", fontSize:"11px" }}>✕</button>
                  </>
                ) : (
                  <>
                    {(playlists[activePl]||[]).length > 0 && (
                      <button onClick={() => playTrack(playlists[activePl][0], playlists[activePl], 0)}
                        style={{ padding:"4px 10px", background:"linear-gradient(135deg,#e50914,#c40812)", border:"none", color:"#fff", borderRadius:"6px", cursor:"pointer", fontSize:"11px", fontWeight:700 }}>
                        ▶ Play All
                      </button>
                    )}
                    <button onClick={() => { setRenamingPl(activePl); setRenameVal(activePl); }}
                      style={{ padding:"4px 10px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.5)", borderRadius:"6px", cursor:"pointer", fontSize:"11px" }}>
                      ✏ Rename
                    </button>
                    <button onClick={() => deletePl(activePl)}
                      style={{ padding:"4px 10px", background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.2)", color:"#f87171", borderRadius:"6px", cursor:"pointer", fontSize:"11px" }}>
                      🗑 Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {loading && (
            <div style={{ textAlign:"center", padding:"48px", color:"rgba(255,255,255,0.3)" }}>
              <div style={{ width:"20px", height:"20px", margin:"0 auto 10px", border:"2px solid rgba(229,9,20,0.15)", borderTopColor:"#e50914", borderRadius:"50%", animation:"ns-spin 0.7s linear infinite" }}/>
              Loading…
            </div>
          )}

          {!loading && view==="playlist" && activePl && (playlists[activePl]||[]).length===0 && (
            <div style={{ textAlign:"center", padding:"48px 20px", color:"rgba(255,255,255,0.3)", fontSize:"13px" }}>
              <div style={{ fontSize:"36px", marginBottom:"10px" }}>🎵</div>
              Playlist empty — search for tracks and click ➕ to add them.
            </div>
          )}

          {/* Playlist rows with reorder */}
          {!loading && view==="playlist" && activePl
            ? (playlists[activePl]||[]).map((track, i) => (
              <div key={track.id+i} style={{ display:"flex", alignItems:"center", gap:"4px" }}>
                <div style={{ display:"flex", flexDirection:"column" }}>
                  <button onClick={() => movePl(activePl, i, -1)} disabled={i===0}
                    style={{ background:"none", border:"none", color:"rgba(255,255,255,0.2)", cursor:i===0?"default":"pointer", fontSize:"10px", padding:"0 3px", lineHeight:1.4 }}>▲</button>
                  <button onClick={() => movePl(activePl, i, 1)} disabled={i===(playlists[activePl]||[]).length-1}
                    style={{ background:"none", border:"none", color:"rgba(255,255,255,0.2)", cursor:i===(playlists[activePl]||[]).length-1?"default":"pointer", fontSize:"10px", padding:"0 3px", lineHeight:1.4 }}>▼</button>
                </div>
                <div style={{ flex:1 }}>
                  <TrackRow track={track} index={i+1}
                    isActive={ytTrack?.id===track.id} isPlaying={ytPlaying&&ytTrack?.id===track.id}
                    onClick={() => playTrack(track, playlists[activePl], i)}
                    onAdd={(plName) => addToPlaylist(plName, track)}
                    onWatch={wtJoined&&wtIsHost ? () => watchInRoom(track) : null}
                    playlists={playlists} inPlaylist={trackInPl(track)}/>
                </div>
                <button onClick={() => removeFromPl(activePl, track.id)}
                  style={{ background:"none", border:"none", color:"rgba(255,255,255,0.2)", cursor:"pointer", fontSize:"14px", padding:"0 4px", flexShrink:0 }}>✕</button>
              </div>
            ))
            : !loading && currentList.map((track, i) => (
              <TrackRow key={track.id} track={track} index={i+1}
                isActive={ytTrack?.id===track.id} isPlaying={ytPlaying&&ytTrack?.id===track.id}
                onClick={() => playTrack(track, currentList, i)}
                onAdd={(plName) => addToPlaylist(plName, track)}
                onWatch={wtJoined&&wtIsHost ? () => watchInRoom(track) : null}
                playlists={playlists} inPlaylist={trackInPl(track)}/>
            ))
          }

          {!loading && !view.startsWith("playlist") && currentList.length===0 && !error && (
            <div style={{ textAlign:"center", padding:"48px 20px", color:"rgba(255,255,255,0.3)", fontSize:"13px" }}>
              {view==="trending" ? "Could not load trending — search above." : "No results found."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}