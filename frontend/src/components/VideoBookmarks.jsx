import { useState, useEffect } from "react";

const STORAGE_KEY = "ns_bookmarks";

function loadBookmarks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveBookmarks(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function fmtTime(s) {
  if (!s || isNaN(s)) return "0:00";
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = Math.floor(s%60);
  return h>0?`${h}:${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`:`${m}:${String(ss).padStart(2,"0")}`;
}

export default function VideoBookmarks({ videoId, videoTitle, getCurrentTime, onSeek, onClose }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const all = loadBookmarks();
    setBookmarks(all[videoId] || []);
  }, [videoId]);

  const persist = (bms) => {
    const all = loadBookmarks();
    all[videoId] = bms;
    saveBookmarks(all);
    setBookmarks(bms);
  };

  const addBookmark = () => {
    const t = getCurrentTime?.() || 0;
    const bm = { id: Date.now(), time: t, note: note.trim() || fmtTime(t), created: Date.now() };
    const updated = [...bookmarks, bm].sort((a,b) => a.time - b.time);
    persist(updated);
    setNote("");
    setAdding(false);
  };

  const removeBookmark = (id) => {
    persist(bookmarks.filter(b => b.id !== id));
  };

  return (
    <div style={{
      position: "fixed", top: "60px", left: "20px",
      background: "rgba(10,10,10,0.98)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "16px", padding: "16px",
      zIndex: 480, width: "260px", maxHeight: "400px",
      boxShadow: "0 12px 40px rgba(0,0,0,0.9)",
      backdropFilter: "blur(20px)",
      animation: "fadeIn 0.15s ease",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px" }}>
        <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
          <span style={{ fontSize:"15px" }}>🔖</span>
          <span style={{ fontSize:"13px",fontWeight:700,color:"#fff" }}>Bookmarks</span>
          {bookmarks.length > 0 && <span style={{ fontSize:"10px",color:"var(--text3)",background:"rgba(255,255,255,0.06)",padding:"1px 6px",borderRadius:"6px" }}>{bookmarks.length}</span>}
        </div>
        <button onClick={onClose} style={{ background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"16px" }}>✕</button>
      </div>

      <p style={{ margin:"0 0 10px",fontSize:"11px",color:"var(--text3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{videoTitle}</p>

      {/* Add bookmark */}
      {adding ? (
        <div style={{ marginBottom:"12px" }}>
          <input
            type="text"
            placeholder="Note (optional)..."
            value={note}
            onChange={e=>setNote(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter") addBookmark(); if(e.key==="Escape") setAdding(false); }}
            autoFocus
            style={{ width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#fff",borderRadius:"8px",padding:"7px 10px",fontSize:"12px",outline:"none",boxSizing:"border-box",marginBottom:"8px" }}
          />
          <div style={{ display:"flex",gap:"6px" }}>
            <button onClick={addBookmark} style={{ flex:1,padding:"7px",background:"var(--red)",border:"none",color:"#fff",borderRadius:"7px",cursor:"pointer",fontSize:"12px",fontWeight:600 }}>Add at {fmtTime(getCurrentTime?.())}</button>
            <button onClick={()=>setAdding(false)} style={{ padding:"7px 10px",background:"rgba(255,255,255,0.06)",border:"1px solid var(--border)",color:"var(--text3)",borderRadius:"7px",cursor:"pointer",fontSize:"12px" }}>✕</button>
          </div>
        </div>
      ) : (
        <button onClick={()=>setAdding(true)} style={{ width:"100%",padding:"8px",background:"rgba(255,255,255,0.04)",border:"1px dashed rgba(255,255,255,0.12)",color:"var(--text3)",borderRadius:"8px",cursor:"pointer",fontSize:"12px",marginBottom:"10px",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",transition:"all 0.15s" }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--red)";e.currentTarget.style.color="#fff";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.12)";e.currentTarget.style.color="var(--text3)";}}>
          + Add bookmark at current time
        </button>
      )}

      {/* Bookmark list */}
      <div style={{ flex:1,overflowY:"auto" }}>
        {bookmarks.length === 0 ? (
          <div style={{ textAlign:"center",padding:"20px 0",color:"var(--text3)",fontSize:"12px" }}>
            No bookmarks yet.<br/>Press + to add one.
          </div>
        ) : bookmarks.map(bm=>(
          <div key={bm.id}
            style={{ display:"flex",alignItems:"center",gap:"8px",padding:"8px 10px",borderRadius:"8px",marginBottom:"3px",cursor:"pointer",transition:"background 0.15s",background:"rgba(255,255,255,0.02)" }}
            onClick={()=>onSeek?.(bm.time)}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.06)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"}
          >
            <span style={{ fontSize:"10px",fontFamily:"monospace",color:"var(--red)",fontWeight:700,flexShrink:0,background:"rgba(229,9,20,0.12)",padding:"2px 6px",borderRadius:"4px" }}>{fmtTime(bm.time)}</span>
            <span style={{ flex:1,fontSize:"12px",color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{bm.note}</span>
            <button onClick={e=>{e.stopPropagation();removeBookmark(bm.id);}} style={{ background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"12px",opacity:0,transition:"opacity 0.15s",padding:"2px 4px" }}
              onMouseEnter={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.color="#e50914";}}
              onMouseLeave={e=>{e.currentTarget.style.opacity="0";}}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}