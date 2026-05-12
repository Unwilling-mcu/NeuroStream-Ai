// ─── Loop Mode Panel ──────────────────────────────────────────────
export function LoopMode({ loopMode, onChange }) {
  const MODES = [
    { id: "none",   icon: "➡",  label: "No Loop",     hint: "Play once and stop" },
    { id: "one",    icon: "🔂", label: "Loop One",    hint: "Repeat current track" },
    { id: "all",    icon: "🔁", label: "Loop All",    hint: "Loop entire library" },
  ];
  return (
    <div style={{ display:"flex",gap:"6px" }}>
      {MODES.map(m=>(
        <button key={m.id} onClick={()=>onChange(m.id)} title={m.hint}
          style={{ display:"flex",alignItems:"center",gap:"5px",padding:"5px 12px",borderRadius:"8px",border:loopMode===m.id?"1px solid var(--red)":"1px solid rgba(255,255,255,0.1)",background:loopMode===m.id?"rgba(229,9,20,0.15)":"rgba(255,255,255,0.04)",color:loopMode===m.id?"#fff":"var(--text3)",fontSize:"12px",fontWeight:loopMode===m.id?600:400,cursor:"pointer",transition:"all 0.15s" }}>
          <span>{m.icon}</span>
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Recent Files Panel ────────────────────────────────────────────
const RECENT_KEY = "ns_recent";
const MAX_RECENT = 20;

export function addToRecent(video) {
  if (!video?.file_path || video.file_path.startsWith("blob:")) return;
  try {
    const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    const filtered = recent.filter(r => r.file_path !== video.file_path);
    const updated = [{ id: video.id, title: video.title, file_path: video.file_path, url: video.url, filename: video.filename, folder_path: video.folder_path, addedAt: Date.now() }, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {}
}

export function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}

export function RecentFiles({ onPlay, onClose }) {
  const recent = getRecent();

  return (
    <div style={{ position:"fixed",top:"60px",right:"20px",background:"rgba(10,10,10,0.98)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"16px",padding:"16px",zIndex:480,width:"280px",maxHeight:"420px",boxShadow:"0 12px 40px rgba(0,0,0,0.9)",backdropFilter:"blur(20px)",animation:"fadeIn 0.15s ease",display:"flex",flexDirection:"column" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px" }}>
        <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
          <span style={{ fontSize:"15px" }}>🕐</span>
          <span style={{ fontSize:"13px",fontWeight:700,color:"#fff" }}>Recent Files</span>
        </div>
        <button onClick={onClose} style={{ background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"16px" }}>✕</button>
      </div>

      <div style={{ flex:1,overflowY:"auto" }}>
        {recent.length === 0 ? (
          <div style={{ textAlign:"center",padding:"30px 0",color:"var(--text3)",fontSize:"12px" }}>No recent files yet.</div>
        ) : recent.map((r,i) => (
          <div key={r.file_path+i}
            onClick={()=>{ onPlay(r); onClose(); }}
            style={{ display:"flex",alignItems:"center",gap:"10px",padding:"9px 10px",borderRadius:"8px",marginBottom:"3px",cursor:"pointer",transition:"background 0.15s" }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.06)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}
          >
            <span style={{ fontSize:"14px",flexShrink:0 }}>🎬</span>
            <div style={{ flex:1,overflow:"hidden" }}>
              <div style={{ fontSize:"12px",fontWeight:500,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{r.title}</div>
              <div style={{ fontSize:"10px",color:"var(--text3)",marginTop:"1px" }}>{new Date(r.addedAt).toLocaleDateString()}</div>
            </div>
          </div>
        ))}
      </div>

      {recent.length > 0 && (
        <button onClick={()=>{ localStorage.removeItem(RECENT_KEY); onClose(); }}
          style={{ marginTop:"10px",width:"100%",padding:"7px",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",color:"var(--text3)",borderRadius:"8px",cursor:"pointer",fontSize:"11px",transition:"all 0.15s" }}
          onMouseEnter={e=>{e.currentTarget.style.color="#fff";e.currentTarget.style.borderColor="rgba(255,255,255,0.2)";}}
          onMouseLeave={e=>{e.currentTarget.style.color="var(--text3)";e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";}}>
          Clear History
        </button>
      )}
    </div>
  );
}

// ─── Video Notes Panel ─────────────────────────────────────────────
const NOTES_KEY = "ns_notes";

export function VideoNotes({ videoId, videoTitle, getCurrentTime, onClose }) {
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");

  useEffect(()=>{
    try {
      const all = JSON.parse(localStorage.getItem(NOTES_KEY)||"{}");
      setNotes(all[videoId]||[]);
    } catch { setNotes([]); }
  },[videoId]);

  const persist = (n) => {
    try {
      const all = JSON.parse(localStorage.getItem(NOTES_KEY)||"{}");
      all[videoId] = n;
      localStorage.setItem(NOTES_KEY, JSON.stringify(all));
    } catch {}
    setNotes(n);
  };

  const addNote = () => {
    if(!text.trim()) return;
    const t = getCurrentTime?.() || 0;
    const note = { id:Date.now(), time:t, text:text.trim() };
    persist([...notes, note].sort((a,b)=>a.time-b.time));
    setText("");
  };

  const fmtTime = s => {
    if(!s||isNaN(s)) return "0:00";
    const m=Math.floor(s/60),ss=Math.floor(s%60);
    return `${m}:${String(ss).padStart(2,"0")}`;
  };

  return (
    <div style={{ position:"fixed",bottom:"110px",right:"20px",background:"rgba(10,10,10,0.98)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"16px",padding:"16px",zIndex:480,width:"270px",maxHeight:"360px",boxShadow:"0 12px 40px rgba(0,0,0,0.9)",backdropFilter:"blur(20px)",animation:"fadeIn 0.15s ease",display:"flex",flexDirection:"column" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px" }}>
        <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
          <span>📝</span>
          <span style={{ fontSize:"13px",fontWeight:700,color:"#fff" }}>Notes</span>
        </div>
        <button onClick={onClose} style={{ background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"16px" }}>✕</button>
      </div>
      <p style={{ margin:"0 0 10px",fontSize:"10px",color:"var(--text3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{videoTitle}</p>

      {/* Input */}
      <div style={{ display:"flex",gap:"6px",marginBottom:"10px" }}>
        <input type="text" placeholder={`Note at ${fmtTime(getCurrentTime?.())}...`} value={text} onChange={e=>setText(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter") addNote(); }}
          style={{ flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#fff",borderRadius:"8px",padding:"7px 10px",fontSize:"12px",outline:"none" }}
        />
        <button onClick={addNote} style={{ background:"var(--red)",border:"none",color:"#fff",borderRadius:"8px",padding:"7px 12px",cursor:"pointer",fontSize:"12px",fontWeight:700,flexShrink:0 }}>+</button>
      </div>

      {/* Notes list */}
      <div style={{ flex:1,overflowY:"auto" }}>
        {notes.length===0 ? (
          <div style={{ textAlign:"center",padding:"20px 0",color:"var(--text3)",fontSize:"12px" }}>No notes yet. Type one above!</div>
        ) : notes.map(n=>(
          <div key={n.id} style={{ display:"flex",gap:"8px",padding:"8px 10px",borderRadius:"8px",marginBottom:"3px",background:"rgba(255,255,255,0.02)",transition:"background 0.15s" }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"}
          >
            <span style={{ fontSize:"10px",color:"var(--red)",fontWeight:700,flexShrink:0,background:"rgba(229,9,20,0.12)",padding:"2px 6px",borderRadius:"4px",height:"fit-content",marginTop:"1px" }}>{fmtTime(n.time)}</span>
            <span style={{ flex:1,fontSize:"12px",color:"var(--text2)",lineHeight:1.4 }}>{n.text}</span>
            <button onClick={()=>persist(notes.filter(x=>x.id!==n.id))} style={{ background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"11px",flexShrink:0,opacity:0,transition:"opacity 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.color="#e50914";}}
              onMouseLeave={e=>{e.currentTarget.style.opacity="0";}}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Lyrics Display ────────────────────────────────────────────────
export function LyricsPanel({ track, artist, onClose }) {
  const [lyrics, setLyrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLyrics = async () => {
    if (!track) return;
    setLoading(true); setError(null); setLyrics(null);
    try {
      // Use lyrics.ovh — free, no API key needed
      const q = artist ? `${artist}/${track}` : `Unknown/${track}`;
      const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist||"Unknown")}/${encodeURIComponent(track)}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      if (data.lyrics) setLyrics(data.lyrics);
      else throw new Error("No lyrics");
    } catch {
      setError("Lyrics not found for this track.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLyrics(); }, [track, artist]);

  return (
    <div style={{ position:"fixed",top:"60px",left:"50%",transform:"translateX(-50%)",background:"rgba(10,10,10,0.98)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"16px",padding:"16px 20px",zIndex:480,width:"380px",maxHeight:"70vh",boxShadow:"0 12px 40px rgba(0,0,0,0.9)",backdropFilter:"blur(20px)",animation:"fadeIn 0.15s ease",display:"flex",flexDirection:"column" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px" }}>
        <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
          <span>🎤</span>
          <div>
            <div style={{ fontSize:"13px",fontWeight:700,color:"#fff" }}>{track||"Unknown"}</div>
            {artist && <div style={{ fontSize:"11px",color:"var(--text3)" }}>{artist}</div>}
          </div>
        </div>
        <button onClick={onClose} style={{ background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"16px" }}>✕</button>
      </div>

      <div style={{ flex:1,overflowY:"auto" }}>
        {loading && (
          <div style={{ textAlign:"center",padding:"40px 0",color:"var(--text3)" }}>
            <div style={{ width:"20px",height:"20px",border:"2px solid rgba(229,9,20,0.3)",borderTopColor:"var(--red)",borderRadius:"50%",animation:"spin 0.7s linear infinite",margin:"0 auto 10px" }}/>
            Fetching lyrics...
          </div>
        )}
        {error && (
          <div style={{ textAlign:"center",padding:"40px 20px" }}>
            <div style={{ fontSize:"28px",marginBottom:"10px",opacity:0.3 }}>🎤</div>
            <div style={{ color:"var(--text3)",fontSize:"13px",marginBottom:"14px" }}>{error}</div>
            <button onClick={fetchLyrics} style={{ background:"rgba(229,9,20,0.15)",border:"1px solid rgba(229,9,20,0.3)",color:"var(--red)",borderRadius:"8px",padding:"6px 14px",cursor:"pointer",fontSize:"12px" }}>Try again</button>
          </div>
        )}
        {lyrics && (
          <pre style={{ margin:0,fontFamily:"inherit",fontSize:"13px",color:"var(--text2)",lineHeight:1.8,whiteSpace:"pre-wrap",wordBreak:"break-word" }}>{lyrics}</pre>
        )}
      </div>
    </div>
  );
}

// Need useState for VideoNotes and LyricsPanel
import { useState, useEffect } from "react";