import { useState, useEffect, useRef } from "react";

// Spotify App credentials — user needs to create a free Spotify App
// at https://developer.spotify.com/dashboard
// Then add http://localhost:5173/spotify-callback as Redirect URI
const CLIENT_ID = localStorage.getItem("ns_spotify_client_id") || "";
const REDIRECT_URI = "http://localhost:5173";
const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-library-read",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
].join("%20");

function getToken() { try { return localStorage.getItem("ns_spotify_token"); } catch { return null; } }
function saveToken(t) { try { localStorage.setItem("ns_spotify_token", t); } catch {} }
function clearToken() { try { localStorage.removeItem("ns_spotify_token"); } catch {} }

async function spotifyFetch(endpoint, token) {
  const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) { clearToken(); throw new Error("Token expired"); }
  if (!res.ok) throw new Error(`Spotify API error: ${res.status}`);
  return res.json();
}

function msToTime(ms) {
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2,"0")}`;
}

export default function SpotifyPage() {
  const [clientId, setClientId] = useState(CLIENT_ID);
  const [token, setToken]       = useState(getToken());
  const [playlists, setPlaylists] = useState([]);
  const [selected, setSelected]   = useState(null);
  const [tracks, setTracks]       = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [playing, setPlaying]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [search, setSearch]       = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [player, setPlayer]       = useState(null);
  const [deviceId, setDeviceId]   = useState(null);
  const [progress, setProgress]   = useState(0);
  const [duration, setDuration]   = useState(0);
  const [volume, setVolume]       = useState(0.8);
  const [view, setView]           = useState("playlists"); // playlists | tracks | search
  const progressTimer = useRef(null);

  // Handle OAuth callback
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      const params = new URLSearchParams(hash.replace("#","?"));
      const t = params.get("access_token");
      if (t) { saveToken(t); setToken(t); window.history.replaceState({}, "", window.location.pathname); }
    }
  }, []);

  // Load playlists when token available
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    spotifyFetch("/me/playlists?limit=50", token)
      .then(d => setPlaylists(d.items||[]))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  // Initialize Spotify Web Playback SDK
  useEffect(() => {
    if (!token) return;
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const p = new window.Spotify.Player({
        name: "NeuroStream AI",
        getOAuthToken: cb => cb(token),
        volume: volume,
      });
      p.addListener("ready", ({ device_id }) => { setDeviceId(device_id); setPlayer(p); });
      p.addListener("player_state_changed", state => {
        if (!state) return;
        setCurrentTrack(state.track_window?.current_track);
        setPlaying(!state.paused);
        setProgress(state.position);
        setDuration(state.duration);
      });
      p.connect();
    };
    return () => { document.body.removeChild(script); };
  }, [token]);

  // Progress ticker
  useEffect(() => {
    if (playing) {
      progressTimer.current = setInterval(() => setProgress(p => p + 500), 500);
    } else {
      clearInterval(progressTimer.current);
    }
    return () => clearInterval(progressTimer.current);
  }, [playing]);

  const login = () => {
    if (!clientId) { alert("Enter your Spotify Client ID first."); return; }
    localStorage.setItem("ns_spotify_client_id", clientId);
    window.location.href = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${SCOPES}&show_dialog=true`;
  };

  const logout = () => { clearToken(); setToken(null); setPlaylists([]); setCurrentTrack(null); player?.disconnect(); };

  const loadPlaylist = async (pl) => {
    setSelected(pl); setView("tracks"); setLoading(true);
    try {
      const d = await spotifyFetch(`/playlists/${pl.id}/tracks?limit=100`, token);
      setTracks(d.items?.filter(i=>i.track).map(i=>i.track)||[]);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const playTrack = async (track) => {
    if (!deviceId) { alert("Spotify player not ready. Wait a moment and try again."); return; }
    try {
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        headers: { Authorization:`Bearer ${token}`, "Content-Type":"application/json" },
        body: JSON.stringify({ uris: [track.uri] }),
      });
      setCurrentTrack(track); setPlaying(true);
    } catch(e) { setError(e.message); }
  };

  const doSearch = async () => {
    if (!search.trim()) return;
    try {
      const d = await spotifyFetch(`/search?q=${encodeURIComponent(search)}&type=track&limit=20`, token);
      setSearchResults(d.tracks?.items||[]);
      setView("search");
    } catch(e) { setError(e.message); }
  };

  const togglePlay = () => { player?.togglePlay(); };
  const seekTo = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const pos = Math.floor(ratio * duration);
    player?.seek(pos);
    setProgress(pos);
  };

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  // ── Setup screen ─────────────────────────────────────────────────
  if (!token) {
    return (
      <div style={{ flex:1,overflowY:"auto",padding:"24px 28px" }}>
        <div style={{ maxWidth:"480px" }}>
          <div style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"24px" }}>
            <div style={{ width:"48px",height:"48px",borderRadius:"50%",background:"#1db954",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"24px" }}>🟢</div>
            <div>
              <h2 style={{ margin:0,fontSize:"20px",fontWeight:800,color:"#fff" }}>Spotify Connect</h2>
              <p style={{ margin:0,fontSize:"13px",color:"var(--text3)" }}>Stream music from your Spotify library</p>
            </div>
          </div>

          <div style={{ background:"rgba(29,185,84,0.08)",border:"1px solid rgba(29,185,84,0.2)",borderRadius:"12px",padding:"16px 18px",marginBottom:"20px" }}>
            <div style={{ fontSize:"13px",fontWeight:600,color:"#1db954",marginBottom:"8px" }}>Setup (free, takes 2 minutes)</div>
            <ol style={{ margin:0,paddingLeft:"18px",fontSize:"12px",color:"var(--text2)",lineHeight:2 }}>
              <li>Go to <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" style={{ color:"#1db954" }}>developer.spotify.com/dashboard</a></li>
              <li>Click "Create App" — name it anything</li>
              <li>Add <code style={{ background:"rgba(255,255,255,0.06)",padding:"1px 5px",borderRadius:"3px" }}>http://localhost:5173</code> as Redirect URI</li>
              <li>Copy your Client ID and paste below</li>
            </ol>
          </div>

          <div style={{ marginBottom:"12px" }}>
            <label style={{ fontSize:"11px",color:"var(--text3)",letterSpacing:"0.06em",display:"block",marginBottom:"6px" }}>SPOTIFY CLIENT ID</label>
            <input type="text" placeholder="Paste your Client ID here..." value={clientId} onChange={e=>setClientId(e.target.value)}
              style={{ width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#fff",borderRadius:"9px",padding:"10px 14px",fontSize:"13px",outline:"none",fontFamily:"monospace",boxSizing:"border-box" }}
            />
          </div>

          <button onClick={login} style={{ width:"100%",padding:"12px",background:"#1db954",border:"none",color:"#000",borderRadius:"10px",cursor:"pointer",fontSize:"14px",fontWeight:800,letterSpacing:"0.02em" }}>
            Connect with Spotify
          </button>
          <p style={{ fontSize:"11px",color:"var(--text3)",textAlign:"center",marginTop:"12px" }}>
            Requires Spotify Premium for playback. Free accounts can browse playlists.
          </p>
        </div>
      </div>
    );
  }

  // ── Main view ─────────────────────────────────────────────────────
  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
      {/* Top bar */}
      <div style={{ padding:"16px 28px 0",display:"flex",alignItems:"center",gap:"12px",flexShrink:0 }}>
        <div style={{ width:"32px",height:"32px",borderRadius:"50%",background:"#1db954",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px",flexShrink:0 }}>🟢</div>
        <span style={{ fontSize:"15px",fontWeight:700,color:"#fff" }}>Spotify</span>

        {/* Search */}
        <div style={{ flex:1,display:"flex",gap:"8px",maxWidth:"400px" }}>
          <input type="text" placeholder="Search songs, artists..." value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()}
            style={{ flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#fff",borderRadius:"8px",padding:"7px 12px",fontSize:"13px",outline:"none" }}
          />
          <button onClick={doSearch} style={{ padding:"7px 14px",background:"#1db954",border:"none",color:"#000",borderRadius:"8px",cursor:"pointer",fontSize:"12px",fontWeight:700 }}>Search</button>
        </div>

        {/* View toggle */}
        {view==="tracks"&&selected&&(
          <button onClick={()=>setView("playlists")} style={{ padding:"6px 12px",background:"rgba(255,255,255,0.06)",border:"1px solid var(--border)",color:"var(--text3)",borderRadius:"8px",cursor:"pointer",fontSize:"12px" }}>← Playlists</button>
        )}

        <button onClick={logout} style={{ padding:"6px 12px",background:"rgba(229,9,20,0.1)",border:"1px solid rgba(229,9,20,0.2)",color:"var(--red)",borderRadius:"8px",cursor:"pointer",fontSize:"11px" }}>Logout</button>
      </div>

      {error&&<div style={{ margin:"10px 28px",padding:"10px 14px",background:"rgba(229,9,20,0.1)",border:"1px solid rgba(229,9,20,0.3)",borderRadius:"8px",fontSize:"12px",color:"#ff6b6b" }}>⚠️ {error} <button onClick={()=>setError(null)} style={{ background:"none",border:"none",color:"#ff6b6b",cursor:"pointer",float:"right" }}>✕</button></div>}

      {/* Content */}
      <div style={{ flex:1,overflowY:"auto",padding:"16px 28px" }}>
        {loading && <div style={{ textAlign:"center",padding:"40px",color:"var(--text3)" }}><div style={{ width:"20px",height:"20px",border:"2px solid rgba(29,185,84,0.3)",borderTopColor:"#1db954",borderRadius:"50%",animation:"spin 0.7s linear infinite",margin:"0 auto 10px" }}/>Loading...</div>}

        {/* Playlists grid */}
        {!loading && view==="playlists" && (
          <>
            <div style={{ fontSize:"11px",color:"var(--text3)",letterSpacing:"0.08em",marginBottom:"14px" }}>YOUR PLAYLISTS — {playlists.length}</div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))",gap:"12px" }}>
              {playlists.map(pl=>(
                <div key={pl.id} onClick={()=>loadPlaylist(pl)}
                  style={{ cursor:"pointer",borderRadius:"10px",overflow:"hidden",background:"rgba(255,255,255,0.03)",border:"1px solid var(--border)",transition:"all 0.15s" }}
                  onMouseEnter={e=>{e.currentTarget.style.background="rgba(29,185,84,0.1)";e.currentTarget.style.borderColor="rgba(29,185,84,0.3)";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.borderColor="var(--border)";}}
                >
                  <div style={{ width:"100%",aspectRatio:"1",background:"rgba(29,185,84,0.1)",overflow:"hidden" }}>
                    {pl.images?.[0] ? <img src={pl.images[0].url} alt={pl.name} style={{ width:"100%",height:"100%",objectFit:"cover" }}/> : <div style={{ width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"32px" }}>🎵</div>}
                  </div>
                  <div style={{ padding:"10px" }}>
                    <div style={{ fontSize:"12px",fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{pl.name}</div>
                    <div style={{ fontSize:"10px",color:"var(--text3)",marginTop:"2px" }}>{pl.tracks?.total} tracks</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Tracks list */}
        {!loading && view==="tracks" && (
          <>
            <div style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"16px" }}>
              {selected?.images?.[0]&&<img src={selected.images[0].url} alt="" style={{ width:"56px",height:"56px",borderRadius:"8px",objectFit:"cover" }}/>}
              <div>
                <div style={{ fontSize:"16px",fontWeight:700,color:"#fff" }}>{selected?.name}</div>
                <div style={{ fontSize:"12px",color:"var(--text3)" }}>{tracks.length} tracks</div>
              </div>
            </div>
            {tracks.map((track,i)=>(
              <TrackRow key={track.id} track={track} index={i+1} isActive={currentTrack?.id===track.id} isPlaying={playing&&currentTrack?.id===track.id} onClick={()=>playTrack(track)}/>
            ))}
          </>
        )}

        {/* Search results */}
        {!loading && view==="search" && (
          <>
            <div style={{ fontSize:"11px",color:"var(--text3)",letterSpacing:"0.08em",marginBottom:"14px" }}>SEARCH RESULTS — {searchResults.length}</div>
            {searchResults.map((track,i)=>(
              <TrackRow key={track.id} track={track} index={i+1} isActive={currentTrack?.id===track.id} isPlaying={playing&&currentTrack?.id===track.id} onClick={()=>playTrack(track)}/>
            ))}
          </>
        )}
      </div>

      {/* Now playing bar */}
      {currentTrack && (
        <div style={{ flexShrink:0,padding:"12px 28px",borderTop:"1px solid var(--border)",background:"rgba(10,10,10,0.98)",backdropFilter:"blur(20px)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:"14px" }}>
            {currentTrack.album?.images?.[0]&&<img src={currentTrack.album.images[0].url} alt="" style={{ width:"44px",height:"44px",borderRadius:"6px",flexShrink:0 }}/>}
            <div style={{ flex:1,overflow:"hidden" }}>
              <div style={{ fontSize:"13px",fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{currentTrack.name}</div>
              <div style={{ fontSize:"11px",color:"var(--text3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{currentTrack.artists?.map(a=>a.name).join(", ")}</div>
            </div>
            <div style={{ display:"flex",gap:"8px",alignItems:"center",flexShrink:0 }}>
              <button onClick={()=>player?.previousTrack()} style={{ background:"none",border:"none",color:"#fff",fontSize:"16px",cursor:"pointer" }}>⏮</button>
              <button onClick={togglePlay} style={{ background:"#1db954",border:"none",color:"#000",fontSize:"16px",cursor:"pointer",width:"36px",height:"36px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700 }}>
                {playing?"⏸":"▶"}
              </button>
              <button onClick={()=>player?.nextTrack()} style={{ background:"none",border:"none",color:"#fff",fontSize:"16px",cursor:"pointer" }}>⏭</button>
              <input type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>{setVolume(parseFloat(e.target.value));player?.setVolume(parseFloat(e.target.value));}} style={{ width:"70px",accentColor:"#1db954" }}/>
            </div>
          </div>
          {/* Progress bar */}
          <div onClick={seekTo} style={{ height:"3px",background:"rgba(255,255,255,0.1)",borderRadius:"2px",marginTop:"10px",cursor:"pointer",position:"relative" }} onMouseEnter={e=>e.currentTarget.style.height="5px"} onMouseLeave={e=>e.currentTarget.style.height="3px"}>
            <div style={{ height:"100%",width:`${pct}%`,background:"#1db954",borderRadius:"2px" }}/>
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",marginTop:"3px" }}>
            <span style={{ fontSize:"10px",color:"var(--text3)" }}>{msToTime(progress)}</span>
            <span style={{ fontSize:"10px",color:"var(--text3)" }}>{msToTime(duration)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function TrackRow({ track, index, isActive, isPlaying, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      style={{ display:"flex",alignItems:"center",gap:"12px",padding:"8px 10px",borderRadius:"8px",cursor:"pointer",background:isActive?"rgba(29,185,84,0.1)":hovered?"rgba(255,255,255,0.04)":"transparent",transition:"background 0.15s",marginBottom:"2px" }}
    >
      <div style={{ width:"20px",textAlign:"center",flexShrink:0,fontSize:"12px",color:isActive?"#1db954":"var(--text3)" }}>
        {isPlaying ? "▶" : isActive ? "•" : index}
      </div>
      {track.album?.images?.[0]&&<img src={track.album.images[0].url} alt="" style={{ width:"38px",height:"38px",borderRadius:"4px",flexShrink:0 }}/>}
      <div style={{ flex:1,overflow:"hidden" }}>
        <div style={{ fontSize:"13px",fontWeight:isActive?600:400,color:isActive?"#1db954":"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{track.name}</div>
        <div style={{ fontSize:"11px",color:"var(--text3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{track.artists?.map(a=>a.name).join(", ")} · {track.album?.name}</div>
      </div>
      <span style={{ fontSize:"11px",color:"var(--text3)",flexShrink:0 }}>{msToTime(track.duration_ms)}</span>
    </div>
  );
}