import { useEffect, useState, useCallback, useRef } from "react";
import { useAppStore } from "./store/useAppStore";
import Sidebar from "./components/Sidebar";
import TitleBar from "./components/TitleBar";
import VideoPlayer from "./components/VideoPlayer";
import VideoCard from "./components/VideoCard";
import VoiceAssistant from "./components/VoiceAssistant";
import MiniPlayer from "./components/MiniPlayer";
import NetworkURLPlayer from "./components/NetworkURLPlayer";

// ─── Keyboard shortcuts overlay ───────────────────────────────────
function ShortcutsOverlay({ onClose }) {
  const KEYS = [
    ["Space / K","Play / Pause"],["← / J","Back 10s"],["→ / L","Forward 10s"],
    ["↑ / ↓","Volume"],["M","Mute"],["F","Fullscreen"],["S","Screenshot"],
    ["Esc","Close / Exit"],[",.","Speed −/+"],["?","This panel"],
  ];
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)",animation:"fadeIn 0.15s ease" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"rgba(12,12,12,0.99)",border:"1px solid var(--border)",borderRadius:"16px",padding:"28px 32px",minWidth:"360px",boxShadow:"0 24px 64px rgba(0,0,0,0.9)" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px" }}>
          <h2 style={{ margin:0,fontSize:"16px",fontWeight:700 }}>⌨ Keyboard Shortcuts</h2>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#666",cursor:"pointer",fontSize:"18px" }}>✕</button>
        </div>
        {KEYS.map(([k,d])=>(
          <div key={k} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
            <kbd style={{ background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"6px",padding:"3px 10px",fontSize:"12px",fontFamily:"monospace",color:"#fff" }}>{k}</kbd>
            <span style={{ fontSize:"13px",color:"var(--text2)" }}>{d}</span>
          </div>
        ))}
        <p style={{ margin:"16px 0 0",fontSize:"11px",color:"var(--text3)",textAlign:"center" }}>Press Esc or click outside to close</p>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────
function Toast({ message, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position:"fixed",bottom:"100px",left:"50%",transform:"translateX(-50%)",background:"rgba(18,18,18,0.97)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"10px",padding:"10px 20px",fontSize:"13px",color:"#fff",boxShadow:"0 8px 32px rgba(0,0,0,0.7)",zIndex:900,animation:"fadeIn 0.2s ease",backdropFilter:"blur(16px)",whiteSpace:"nowrap" }}>
      {message}
    </div>
  );
}

// ─── Queue panel ──────────────────────────────────────────────────
function QueuePanel({ queue, current, onPlay, onRemove, onClear, onClose }) {
  return (
    <div style={{ position:"fixed",top:0,right:0,bottom:0,width:"290px",background:"rgba(10,10,10,0.98)",border:"1px solid var(--border)",zIndex:400,display:"flex",flexDirection:"column",boxShadow:"-8px 0 40px rgba(0,0,0,0.8)",backdropFilter:"blur(20px)",animation:"slideInLeft 0.2s ease" }}>
      <div style={{ padding:"18px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:"14px",fontWeight:700 }}>Queue</div>
          <div style={{ fontSize:"11px",color:"var(--text3)" }}>{queue.length} video{queue.length!==1?"s":""}</div>
        </div>
        <div style={{ display:"flex",gap:"6px" }}>
          {queue.length>0&&<button onClick={onClear} style={{ background:"rgba(255,255,255,0.06)",border:"1px solid var(--border)",color:"var(--text3)",borderRadius:"7px",padding:"4px 10px",cursor:"pointer",fontSize:"11px" }}>Clear</button>}
          <button onClick={onClose} style={{ background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"18px" }}>✕</button>
        </div>
      </div>
      <div style={{ flex:1,overflowY:"auto",padding:"8px" }}>
        {queue.length===0 ? (
          <div style={{ padding:"40px 20px",textAlign:"center",color:"var(--text3)",fontSize:"13px" }}>Queue is empty.<br/>Right-click a card to add.</div>
        ) : queue.map((v,i)=>(
          <div key={v.id+i} style={{ display:"flex",alignItems:"center",gap:"10px",padding:"10px",borderRadius:"9px",marginBottom:"4px",background:current?.id===v.id?"rgba(229,9,20,0.1)":"transparent",border:current?.id===v.id?"1px solid rgba(229,9,20,0.3)":"1px solid transparent",cursor:"pointer",transition:"background 0.15s" }} onClick={()=>onPlay(v)} onMouseEnter={e=>{if(current?.id!==v.id)e.currentTarget.style.background="rgba(255,255,255,0.04)"}} onMouseLeave={e=>{if(current?.id!==v.id)e.currentTarget.style.background="transparent"}}>
            <div style={{ width:"22px",flexShrink:0,fontSize:"11px",color:"var(--text3)",textAlign:"center" }}>{i+1}</div>
            <div style={{ flex:1,overflow:"hidden" }}>
              <div style={{ fontSize:"12px",fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{v.title}</div>
              {v.duration>0&&<div style={{ fontSize:"10px",color:"var(--text3)" }}>{Math.floor(v.duration/60)}m</div>}
            </div>
            <button onClick={e=>{e.stopPropagation();onRemove(i);}} style={{ background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"14px",padding:"2px 4px" }} onMouseEnter={e=>e.currentTarget.style.color="#fff"} onMouseLeave={e=>e.currentTarget.style.color="var(--text3)"}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Shared UI ────────────────────────────────────────────────────
function Section({ title, count, children, action }) {
  return (
    <section style={{ marginBottom:"36px" }}>
      <div style={{ display:"flex",alignItems:"center",gap:"10px",marginBottom:"16px" }}>
        <div style={{ width:"3px",height:"16px",background:"var(--red)",borderRadius:"2px",flexShrink:0 }} />
        <h2 style={{ margin:0,fontSize:"15px",fontWeight:700,color:"#fff",letterSpacing:"0.02em" }}>{title}</h2>
        {count!=null&&<span style={{ fontSize:"11px",color:"var(--text3)",background:"rgba(255,255,255,0.06)",padding:"1px 8px",borderRadius:"8px" }}>{count}</span>}
        {action&&<div style={{ marginLeft:"auto" }}>{action}</div>}
      </div>
      {children}
    </section>
  );
}

function Grid({ children }) {
  return <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(190px, 1fr))",gap:"14px" }}>{children}</div>;
}

function ActionBtn({ children, onClick, primary, icon, loading, small }) {
  return (
    <button onClick={onClick} disabled={loading} style={{ padding: small?"7px 14px":"10px 20px", background: primary?"linear-gradient(135deg,#e50914,#c40812)":"rgba(255,255,255,0.05)", border: primary?"none":"1px solid var(--border)", color:"#fff", borderRadius:"9px", fontSize: small?"12px":"13px", fontWeight:600, cursor: loading?"wait":"pointer", display:"flex", alignItems:"center", gap:"7px", transition:"all 0.2s", boxShadow: primary?"0 4px 18px rgba(229,9,20,0.3)":"none", opacity: loading?0.6:1, flexShrink:0 }} onMouseEnter={e=>{if(!loading){e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow=primary?"0 6px 24px rgba(229,9,20,0.45)":"0 4px 16px rgba(0,0,0,0.4)"}}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=primary?"0 4px 18px rgba(229,9,20,0.3)":"none"}}>
      {loading?<Spinner/>:<span>{icon}</span>}{children}
    </button>
  );
}

function Spinner() {
  return <div style={{ width:"13px",height:"13px",border:"2px solid rgba(255,255,255,0.2)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.7s linear infinite" }} />;
}

function EmptyState({ onOpen, onURL }) {
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 40px",textAlign:"center",background:"rgba(255,255,255,0.02)",borderRadius:"16px",border:"1px dashed rgba(255,255,255,0.07)" }}>
      <div style={{ fontSize:"56px",marginBottom:"16px",opacity:0.15 }}>🎬</div>
      <h2 style={{ margin:"0 0 8px",fontSize:"20px",fontWeight:700 }}>No videos yet</h2>
      <p style={{ margin:"0 0 24px",color:"var(--text3)",fontSize:"14px",maxWidth:"280px",lineHeight:1.6 }}>Open a folder, paste a URL, or drag & drop video files here.</p>
      <div style={{ display:"flex",gap:"10px",flexWrap:"wrap",justifyContent:"center" }}>
        <ActionBtn onClick={onOpen} primary icon="📂">Open Folder</ActionBtn>
        <ActionBtn onClick={onURL} icon="🌐">Network URL</ActionBtn>
      </div>
    </div>
  );
}

// ─── Pages ────────────────────────────────────────────────────────
function HomePage({ queue, onQueue, toast, sortBy, sortDir, onURLOpen, currentPage, onRemove }) {
  const { videos, currentVideo, setCurrentVideo, openFolder, openFile, isLoading, history } = useAppStore();
  const isOnHomePage = currentPage === "home";

  const sorted = [...videos].sort((a,b)=>{
    if(sortBy==="name") return sortDir==="asc"?a.title.localeCompare(b.title):b.title.localeCompare(a.title);
    if(sortBy==="duration") return sortDir==="asc"?(a.duration||0)-(b.duration||0):(b.duration||0)-(a.duration||0);
    if(sortBy==="size") return sortDir==="asc"?(a.size||0)-(b.size||0):(b.size||0)-(a.size||0);
    return 0;
  });

  const getProgress = v => { const h = history.find(h=>h.file_path===(v.file_path||v.url)); return h?.progress||0; };

  return (
    <div className="page-enter" style={{ flex:1,overflowY:"auto",padding:"26px 28px" }}>
      {/* Player — only shown on home page */}
      {currentVideo && isOnHomePage && (
        <Section title="Now Playing">
          <VideoPlayer onClose={()=>useAppStore.getState().setCurrentVideo(null)} />
        </Section>
      )}

      <div style={{ display:"flex",gap:"10px",marginBottom:"28px",flexWrap:"wrap",alignItems:"center" }}>
        <ActionBtn onClick={openFolder} primary icon="📂" loading={isLoading}>{isLoading?"Scanning...":"Open Folder"}</ActionBtn>
        <ActionBtn onClick={openFile} icon="🎬">Open File</ActionBtn>
        <ActionBtn onClick={onURLOpen} icon="🌐">Network URL</ActionBtn>
        {videos.length>0&&<span style={{ fontSize:"12px",color:"var(--text3)",marginLeft:"4px" }}>{videos.length} video{videos.length!==1?"s":""}</span>}
      </div>

      {history.length>0&&(
        <Section title="Continue Watching" count={history.length}>
          <Grid>
            {history.slice(0,6).map(h=>{
              const v=videos.find(v=>v.file_path===h.file_path)||{id:h.id,title:h.title,url:h.file_path,file_path:h.file_path,duration:h.duration};
              return <VideoCard key={h.id} video={v} isActive={currentVideo?.file_path===h.file_path} onClick={()=>setCurrentVideo(v)} onQueue={onQueue} progress={h.progress}/>;
            })}
          </Grid>
        </Section>
      )}

      {sorted.length>0 ? (
        <Section title="Library" count={sorted.length}>
          <Grid>
            {sorted.map(v=>(
              <VideoCard key={v.id} video={v} isActive={currentVideo?.id===v.id} onClick={()=>setCurrentVideo(v)} onQueue={onQueue} onRemove={onRemove} progress={getProgress(v)}/>
            ))}
          </Grid>
        </Section>
      ) : (
        <EmptyState onOpen={openFolder} onURL={onURLOpen}/>
      )}
    </div>
  );
}

function LibraryPage({ onQueue, sortBy, sortDir, onRemove }) {
  const { videos,currentVideo,setCurrentVideo,searchResults,searchQuery,history } = useAppStore();
  const display = searchQuery ? searchResults : videos;
  const sorted = [...display].sort((a,b)=>{
    if(sortBy==="name") return sortDir==="asc"?a.title.localeCompare(b.title):b.title.localeCompare(a.title);
    if(sortBy==="duration") return sortDir==="asc"?(a.duration||0)-(b.duration||0):(b.duration||0)-(a.duration||0);
    if(sortBy==="size") return sortDir==="asc"?(a.size||0)-(b.size||0):(b.size||0)-(a.size||0);
    return 0;
  });
  const getProgress = v => { const h=history.find(h=>h.file_path===(v.file_path||v.url)); return h?.progress||0; };

  return (
    <div className="page-enter" style={{ flex:1,overflowY:"auto",padding:"26px 28px" }}>
      <Section title={searchQuery?`Results for "${searchQuery}"`:"Full Library"} count={sorted.length}>
        {sorted.length>0 ? (
          <Grid>
            {sorted.map(v=>(
              <VideoCard key={v.id||v.file_path} video={v} isActive={currentVideo?.file_path===v.file_path} onClick={()=>setCurrentVideo(v)} onQueue={onQueue} onRemove={onRemove} progress={getProgress(v)}/>
            ))}
          </Grid>
        ) : (
          <div style={{ color:"var(--text3)",fontSize:"14px",padding:"40px 0" }}>{searchQuery?"No results found.":"No videos in library. Open a folder first."}</div>
        )}
      </Section>
    </div>
  );
}

function HistoryPage() {
  const { history,setCurrentVideo,loadHistory,videos } = useAppStore();
  useEffect(()=>{ loadHistory(); },[]);
  return (
    <div className="page-enter" style={{ flex:1,overflowY:"auto",padding:"26px 28px" }}>
      <Section title="Continue Watching" count={history.length} action={history.length>0&&(
        <button onClick={async()=>{await fetch("http://localhost:5000/api/history",{method:"DELETE"}).catch(()=>{});loadHistory();}} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid var(--border)",color:"var(--text3)",borderRadius:"7px",padding:"4px 12px",cursor:"pointer",fontSize:"11px" }}>Clear All</button>
      )}>
        {history.length===0 ? (
          <div style={{ color:"var(--text3)",fontSize:"14px",padding:"40px 0" }}>No watch history yet.</div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:"4px" }}>
            {history.map(h=>{
              const pct=h.duration>0?Math.min(100,(h.progress/h.duration)*100):0;
              const video=videos.find(v=>v.file_path===h.file_path)||{id:h.id,title:h.title,url:h.file_path,file_path:h.file_path,duration:h.duration};
              const watched=new Date(h.last_watched*1000).toLocaleDateString();
              return (
                <div key={h.id} onClick={()=>setCurrentVideo(video)} style={{ display:"flex",alignItems:"center",gap:"14px",padding:"13px 14px",borderRadius:"10px",background:"rgba(255,255,255,0.03)",border:"1px solid var(--border)",cursor:"pointer",transition:"background 0.15s",marginBottom:"4px" }} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.06)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.03)"}>
                  <div style={{ width:"42px",height:"42px",borderRadius:"8px",background:"var(--bg3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",flexShrink:0 }}>🎬</div>
                  <div style={{ flex:1,overflow:"hidden" }}>
                    <div style={{ fontSize:"13px",fontWeight:600,color:"#fff",marginBottom:"5px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{h.title}</div>
                    <div style={{ height:"3px",background:"rgba(255,255,255,0.08)",borderRadius:"2px" }}>
                      <div style={{ height:"100%",width:`${pct}%`,background:"var(--red)",borderRadius:"2px" }} />
                    </div>
                  </div>
                  <div style={{ textAlign:"right",flexShrink:0 }}>
                    <div style={{ fontSize:"12px",color:"var(--red)",fontWeight:600 }}>{Math.round(pct)}%</div>
                    <div style={{ fontSize:"10px",color:"var(--text3)",marginTop:"2px" }}>{watched}</div>
                    {h.watch_count>1&&<div style={{ fontSize:"10px",color:"var(--text3)" }}>{h.watch_count}× watched</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

function SettingsPage() {
  const { volume,setVolume,isMuted,setMuted } = useAppStore();
  const tryPiP = async () => {
    const v = document.querySelector("video");
    if(!v){alert("Play a video first.");return;}
    try {
      if(document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch(e){alert("PiP error: "+e.message);}
  };
  return (
    <div className="page-enter" style={{ flex:1,overflowY:"auto",padding:"26px 28px" }}>
      <Section title="Settings">
        <div style={{ maxWidth:"520px" }}>
          <SR label="Default Volume" hint="Startup volume level">
            <input type="range" min="0" max="1" step="0.05" value={isMuted?0:volume} onChange={e=>{setVolume(parseFloat(e.target.value));setMuted(false);}} style={{ width:"180px",accentColor:"var(--red)" }}/>
            <span style={{ color:"var(--text2)",fontSize:"13px",width:"38px" }}>{Math.round(volume*100)}%</span>
          </SR>
          <SR label="Mute on Start" hint="Start all videos muted">
            <Tog value={isMuted} onChange={()=>setMuted(!isMuted)}/>
          </SR>
          <SR label="Picture-in-Picture" hint="Float video in mini window">
            <ActionBtn onClick={tryPiP} small icon="⧉">Toggle PiP</ActionBtn>
          </SR>
          <SR label="Backend" hint="">
            <code style={{ fontSize:"12px",color:"var(--text3)",background:"rgba(255,255,255,0.05)",padding:"4px 10px",borderRadius:"6px" }}>http://localhost:5000</code>
          </SR>
          <SR label="Version" hint=""><span style={{ color:"var(--text3)",fontSize:"13px" }}>NeuroStream AI v3.0.0</span></SR>
        </div>
      </Section>
    </div>
  );
}

function SR({ label,hint,children }) {
  return (
    <div style={{ borderBottom:"1px solid var(--border)",padding:"18px 0" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"20px" }}>
        <div>
          <div style={{ fontSize:"14px",fontWeight:600,color:"#fff",marginBottom:"2px" }}>{label}</div>
          {hint&&<div style={{ fontSize:"12px",color:"var(--text3)" }}>{hint}</div>}
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:"10px",flexShrink:0 }}>{children}</div>
      </div>
    </div>
  );
}

function Tog({ value,onChange }) {
  return (
    <div onClick={onChange} style={{ width:"44px",height:"24px",borderRadius:"12px",background:value?"var(--red)":"rgba(255,255,255,0.1)",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0 }}>
      <div style={{ position:"absolute",top:"3px",left:value?"23px":"3px",width:"18px",height:"18px",borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.4)" }}/>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────
export default function App() {
  const { currentPage,setPage,loadHistory,setCurrentVideo,setVideos,videos,openFolder,currentVideo,removeVideo } = useAppStore();

  const [showShortcuts,setShowShortcuts] = useState(false);
  const [toast,setToast] = useState(null);
  const [queue,setQueue] = useState([]);
  const [showQueue,setShowQueue] = useState(false);
  const [sortBy,setSortBy] = useState("date");
  const [sortDir,setSortDir] = useState("desc");
  const [isDragOver,setIsDragOver] = useState(false);
  const [showNetworkURL,setShowNetworkURL] = useState(false);
  const showMiniPlayer = currentVideo && currentPage !== "home";

  const showToast = useCallback(msg=>setToast(msg),[]);

  useEffect(()=>{ loadHistory(); },[]);

  // ? shortcut
  useEffect(()=>{
    const h=(e)=>{
      if(e.key==="?"&&document.activeElement?.tagName!=="INPUT") setShowShortcuts(s=>!s);
      if(e.key==="Escape"&&showShortcuts) setShowShortcuts(false);
    };
    window.addEventListener("keydown",h);
    return ()=>window.removeEventListener("keydown",h);
  },[showShortcuts]);

  const handleSort = (field) => {
    if(sortBy===field) setSortDir(d=>d==="asc"?"desc":"asc");
    else { setSortBy(field); setSortDir("asc"); }
  };

  const addToQueue = (video) => {
    setQueue(q=>q.find(v=>v.id===video.id)?q:[...q,video]);
    showToast(`Added "${video.title}" to queue`);
  };

  // Drag & drop
  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const exts = [".mp4",".mkv",".avi",".mov",".webm",".m4v",".flv"];
    const vfiles = files.filter(f=>exts.some(ext=>f.name.toLowerCase().endsWith(ext)));
    if(!vfiles.length){ showToast("No supported video files"); return; }
    const newVids = vfiles.map((f,i)=>({
      id:Date.now()+i, title:f.name.replace(/\.[^.]+$/,""),
      filename:f.name, url:URL.createObjectURL(f),
      file_path:f.name, size:f.size, duration:0,
    }));
    setVideos([...videos,...newVids]);
    setCurrentVideo(newVids[0]);
    setPage("home");
    showToast(`Loaded ${newVids.length} video${newVids.length>1?"s":""}`);
  };

  const pages = {
    home:     <HomePage queue={queue} onQueue={addToQueue} toast={showToast} sortBy={sortBy} sortDir={sortDir} onURLOpen={()=>setShowNetworkURL(true)} currentPage={currentPage} onRemove={removeVideo}/>,
    library:  <LibraryPage onQueue={addToQueue} sortBy={sortBy} sortDir={sortDir} onRemove={removeVideo}/>,
    history:  <HistoryPage/>,
    settings: <SettingsPage/>,
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ display:"flex",flexDirection:"column",height:"100vh",background:"var(--bg)",color:"var(--text)",fontFamily:"'Segoe UI',system-ui,-apple-system,sans-serif",overflow:"hidden",outline:isDragOver?"3px dashed var(--red)":"3px solid transparent",transition:"outline 0.15s" }}
    >
      {isDragOver&&(
        <div style={{ position:"fixed",inset:0,background:"rgba(229,9,20,0.07)",zIndex:800,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)",pointerEvents:"none" }}>
          <div style={{ fontSize:"20px",fontWeight:700,color:"var(--red)",background:"rgba(0,0,0,0.85)",padding:"20px 36px",borderRadius:"16px",border:"2px dashed var(--red)" }}>📂 Drop videos to play</div>
        </div>
      )}

      <TitleBar onSort={handleSort} sortBy={sortBy} sortDir={sortDir}/>

      <div style={{ display:"flex",flex:1,overflow:"hidden" }}>
        <Sidebar/>
        {pages[currentPage]||pages.home}
      </div>

      {/* Mini player when on non-home page */}
      {showMiniPlayer && (
        <MiniPlayer onExpand={()=>setPage("home")}/>
      )}

      {/* Queue button */}
      {queue.length>0&&(
        <button onClick={()=>setShowQueue(s=>!s)} style={{ position:"fixed",bottom:showMiniPlayer?"86px":"28px",right:"90px",background:"rgba(14,14,14,0.97)",border:"1px solid var(--border)",color:"#fff",borderRadius:"12px",padding:"8px 14px",cursor:"pointer",zIndex:490,fontSize:"12px",fontWeight:600,display:"flex",alignItems:"center",gap:"7px",boxShadow:"0 4px 20px rgba(0,0,0,0.7)",transition:"bottom 0.3s" }}>
          <span style={{ background:"var(--red)",borderRadius:"6px",padding:"1px 7px",fontSize:"11px" }}>{queue.length}</span>Queue
        </button>
      )}

      {showQueue&&<QueuePanel queue={queue} current={currentVideo} onPlay={v=>{setCurrentVideo(v);setPage("home");setShowQueue(false);}} onRemove={i=>setQueue(q=>q.filter((_,idx)=>idx!==i))} onClear={()=>setQueue([])} onClose={()=>setShowQueue(false)}/>}

      {showNetworkURL&&<NetworkURLPlayer onClose={()=>setShowNetworkURL(false)}/>}
      {toast&&<Toast message={toast} onDone={()=>setToast(null)}/>}
      {showShortcuts&&<ShortcutsOverlay onClose={()=>setShowShortcuts(false)}/>}
      <VoiceAssistant/>
    </div>
  );
}
