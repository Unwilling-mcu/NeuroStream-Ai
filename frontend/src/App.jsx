import { useEffect, useState, useCallback, useRef } from "react";
import { useAppStore } from "./store/useAppStore";
import Sidebar from "./components/Sidebar";
import TitleBar from "./components/TitleBar";
import VideoPlayer from "./components/VideoPlayer";
import VideoCard from "./components/VideoCard";
import VoiceAssistant from "./components/VoiceAssistant";
import MiniPlayer from "./components/MiniPlayer";
import NetworkURLPlayer from "./components/NetworkURLPlayer";
import Equalizer, { connectAudioElement, setEQPreset } from "./components/Equalizer";
import AudioVisualizer from "./components/AudioVisualizer";
import SleepTimer from "./components/SleepTimer";
import VideoBookmarks from "./components/VideoBookmarks";
import YoutubePage from "./components/YoutubePage";
import YoutubeMiniPlayer from "./components/YoutubeMiniPlayer";
import { LoopMode, RecentFiles, VideoNotes, LyricsPanel, addToRecent, getRecent } from "./components/MediaUtils";

// ─── Helpers ──────────────────────────────────────────────────────
function fmtTime(s) {
  if (!s || isNaN(s)) return "0:00";
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = Math.floor(s%60);
  return h>0?`${h}:${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`:`${m}:${String(ss).padStart(2,"0")}`;
}
function isNew(addedAt) {
  return addedAt && (Date.now() - addedAt) < 24*60*60*1000;
}

// ─── OS Notification helper ────────────────────────────────────────
function sendNotification(title, body, icon) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: icon || "/icon.svg", silent: true });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(p => {
      if (p === "granted") new Notification(title, { body, silent: true });
    });
  }
}

// ─── Crossfade helper ─────────────────────────────────────────────
function crossfade(fromEl, toEl, duration = 800) {
  if (!fromEl || !toEl) return;
  const steps = 20;
  const step = duration / steps;
  let i = 0;
  const fade = setInterval(() => {
    i++;
    const progress = i / steps;
    fromEl.volume = Math.max(0, 1 - progress);
    toEl.volume   = Math.min(1, progress);
    if (i >= steps) {
      clearInterval(fade);
      fromEl.pause();
      fromEl.volume = 1;
    }
  }, step);
}

// ─── Shared UI ────────────────────────────────────────────────────
function Section({ title, count, children, action }) {
  return (
    <section style={{ marginBottom:"32px" }}>
      <div style={{ display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px" }}>
        <div style={{ width:"3px",height:"16px",background:"var(--red)",borderRadius:"2px",flexShrink:0 }}/>
        <h2 style={{ margin:0,fontSize:"15px",fontWeight:700,color:"#fff" }}>{title}</h2>
        {count!=null&&count>0&&<span style={{ fontSize:"11px",color:"var(--text3)",background:"rgba(255,255,255,0.06)",padding:"1px 8px",borderRadius:"8px" }}>{count}</span>}
        {action&&<div style={{ marginLeft:"auto" }}>{action}</div>}
      </div>
      {children}
    </section>
  );
}

function Grid({ children }) {
  return <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(188px, 1fr))",gap:"14px" }}>{children}</div>;
}

function Btn({ children, onClick, primary, icon, loading, small, active }) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{ padding:small?"7px 14px":"10px 20px",background:active?"rgba(229,9,20,0.2)":primary?"linear-gradient(135deg,#e50914,#c40812)":"rgba(255,255,255,0.05)",border:active?"1px solid rgba(229,9,20,0.4)":primary?"none":"1px solid var(--border)",color:"#fff",borderRadius:"9px",fontSize:small?"12px":"13px",fontWeight:600,cursor:loading?"wait":"pointer",display:"flex",alignItems:"center",gap:"7px",transition:"all 0.2s",boxShadow:primary?"0 4px 18px rgba(229,9,20,0.3)":"none",opacity:loading?0.6:1,flexShrink:0 }}
      onMouseEnter={e=>{if(!loading)e.currentTarget.style.transform="translateY(-1px)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="";}}
    >
      {loading?<span style={{width:"13px",height:"13px",border:"2px solid rgba(255,255,255,0.2)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite"}}/>:<span>{icon}</span>}
      {children}
    </button>
  );
}

function Empty({ icon, title, desc, actions, hint }) {
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 40px",textAlign:"center",background:"linear-gradient(180deg,rgba(229,9,20,0.03),rgba(255,255,255,0.01))",borderRadius:"20px",border:"1px dashed rgba(229,9,20,0.15)" }}>
      <div style={{ fontSize:"56px",marginBottom:"16px",filter:"drop-shadow(0 0 20px rgba(229,9,20,0.3))" }}>{icon}</div>
      <h2 style={{ margin:"0 0 10px",fontSize:"22px",fontWeight:800,color:"#fff" }}>{title}</h2>
      <p style={{ margin:"0 0 8px",color:"var(--text3)",fontSize:"14px",maxWidth:"300px",lineHeight:1.7 }}>{desc}</p>
      {hint&&<p style={{ margin:"0 0 24px",color:"rgba(229,9,20,0.6)",fontSize:"12px",fontStyle:"italic" }}>{hint}</p>}
      {!hint&&<div style={{ marginBottom:"24px" }}/>}
      <div style={{ display:"flex",gap:"10px",flexWrap:"wrap",justifyContent:"center" }}>{actions}</div>
    </div>
  );
}

function Toast({ message, onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone,2800); return ()=>clearTimeout(t); },[]);
  return <div style={{ position:"fixed",bottom:"100px",left:"50%",transform:"translateX(-50%)",background:"rgba(18,18,18,0.97)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"10px",padding:"10px 20px",fontSize:"13px",color:"#fff",boxShadow:"0 8px 32px rgba(0,0,0,0.7)",zIndex:900,animation:"fadeIn 0.2s ease",backdropFilter:"blur(16px)",whiteSpace:"nowrap" }}>{message}</div>;
}

function ShortcutsOverlay({ onClose }) {
  const KEYS=[["Space/K","Play/Pause video"],["←/J","Back 10s"],["→/L","Forward 10s"],["↑/↓","Volume"],["M","Mute"],["F","Fullscreen"],["S","Screenshot"],["B","Add bookmark"],["Esc","Close"],[",.","Speed −/+"],["A","Play/Pause audio"],["N","Next audio"],["?","This panel"]];
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"rgba(12,12,12,0.99)",border:"1px solid var(--border)",borderRadius:"16px",padding:"28px 32px",minWidth:"380px",boxShadow:"0 24px 64px rgba(0,0,0,0.9)" }}>
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
      </div>
    </div>
  );
}

// ─── Audio Player (with all features) ─────────────────────────────
function AudioPlayer({ audio, onClose, onNext, onPrev, hasNext, hasPrev, loopMode, onLoopChange, showEQ, onToggleEQ, showLyrics, onToggleLyrics, showNotes, onToggleNotes }) {
  const { volume, isMuted, setVolume, setMuted } = useAppStore();
  const ref = useRef(null);
  const prevRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [ct, setCT] = useState(0);
  const [dur, setDur] = useState(0);
  const [artError, setArtError] = useState(false);
  const [artUrl, setArtUrl] = useState(audio?.albumArt||null);
  const [showViz, setShowViz] = useState(true);

  useEffect(()=>{
    if(!audio||!ref.current) return;
    const audioEl = ref.current;

    // Crossfade from previous
    if (prevRef.current && prevRef.current !== audioEl) {
      crossfade(prevRef.current, audioEl, 600);
    }

    audioEl.src = audio.url;
    audioEl.volume = isMuted ? 0 : volume;
    audioEl.play().catch(()=>{});
    setArtError(false);
    setArtUrl(audio.albumArt||null);
    setCT(0);

    // Connect to EQ
    connectAudioElement(audioEl);
    prevRef.current = audioEl;

    // OS notification
    sendNotification("Now Playing", audio.title + (audio.artist ? ` — ${audio.artist}` : ""), audio.albumArt);

    // Fetch album art lazily
    if(!audio.albumArt&&audio.file_path){
      fetch(`http://localhost:5000/api/album-art-generate?file_path=${encodeURIComponent(audio.file_path)}`)
        .then(r=>r.ok?r.json():null).then(d=>{ if(d?.url) setArtUrl(d.url); }).catch(()=>{});
    }
  },[audio]);

  useEffect(()=>{ if(ref.current){ ref.current.volume=isMuted?0:volume; ref.current.muted=isMuted; } },[volume,isMuted]);

  // Audio keyboard shortcuts
  useEffect(()=>{
    const handle=(e)=>{
      const tag=document.activeElement?.tagName;
      if(tag==="INPUT"||tag==="SELECT"||tag==="TEXTAREA") return;
      if(e.key==="a"||e.key==="A"){ e.preventDefault(); if(ref.current) ref.current.paused?ref.current.play():ref.current.pause(); }
      if((e.key==="n"||e.key==="N")&&hasNext){ e.preventDefault(); onNext?.(); }
    };
    window.addEventListener("keydown",handle);
    return ()=>window.removeEventListener("keydown",handle);
  },[hasNext,onNext]);

  const handleEnded = () => {
    if(loopMode==="one"){ ref.current.currentTime=0; ref.current.play(); return; }
    if(hasNext) onNext?.();
    else if(loopMode==="all") onNext?.();
  };

  if(!audio) return null;
  const pct = dur>0?(ct/dur)*100:0;

  return (
    <div style={{ position:"fixed",bottom:"16px",left:"50%",transform:"translateX(-50%)",width:"520px",background:"rgba(10,10,10,0.98)",border:"1px solid rgba(229,9,20,0.25)",borderRadius:"18px",padding:"14px 16px",zIndex:460,boxShadow:"0 8px 48px rgba(0,0,0,0.9)",backdropFilter:"blur(24px)",animation:"fadeIn 0.2s ease" }}>
      <audio ref={ref} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onTimeUpdate={e=>setCT(e.target.currentTime)} onLoadedMetadata={e=>setDur(e.target.duration)} onEnded={handleEnded}/>

      {/* Visualizer */}
      {showViz && <div style={{ marginBottom:"10px" }}><AudioVisualizer audioRef={ref} isPlaying={playing}/></div>}

      {/* Top row: art + info */}
      <div style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"10px" }}>
        <div style={{ width:"46px",height:"46px",borderRadius:"10px",flexShrink:0,overflow:"hidden",background:"linear-gradient(135deg,rgba(229,9,20,0.3),rgba(229,9,20,0.1))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",border:"1px solid rgba(229,9,20,0.3)" }}>
          {artUrl&&!artError?<img src={artUrl} alt="art" onError={()=>setArtError(true)} style={{ width:"100%",height:"100%",objectFit:"cover" }}/>:"🎵"}
        </div>
        <div style={{ flex:1,overflow:"hidden" }}>
          <div style={{ fontSize:"13px",fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{audio.title}</div>
          <div style={{ fontSize:"11px",color:"var(--text3)",marginTop:"2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
            {audio.artist&&<span style={{ color:"rgba(229,9,20,0.8)" }}>{audio.artist}</span>}
            {audio.artist&&audio.album&&" · "}
            {audio.album||(!audio.artist&&`${fmtTime(ct)} / ${fmtTime(dur)}`)}
          </div>
        </div>
        {/* Feature buttons */}
        <div style={{ display:"flex",gap:"4px",flexShrink:0 }}>
          <FBtn onClick={()=>setShowViz(v=>!v)} active={showViz} title="Visualizer">📊</FBtn>
          <FBtn onClick={onToggleEQ} active={showEQ} title="Equalizer">🎛</FBtn>
          <FBtn onClick={onToggleLyrics} active={showLyrics} title="Lyrics">🎤</FBtn>
          <FBtn onClick={onToggleNotes} active={showNotes} title="Notes">📝</FBtn>
        </div>
        <button onClick={onClose} style={{ background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"16px",flexShrink:0 }}>✕</button>
      </div>

      {/* Progress */}
      <div onClick={e=>{const r=e.currentTarget.getBoundingClientRect();const ratio=(e.clientX-r.left)/r.width;if(ref.current&&ref.current.duration)ref.current.currentTime=ratio*ref.current.duration;}}
        style={{ height:"3px",background:"rgba(255,255,255,0.1)",borderRadius:"2px",marginBottom:"10px",cursor:"pointer",transition:"height 0.15s" }}
        onMouseEnter={e=>e.currentTarget.style.height="5px"}
        onMouseLeave={e=>e.currentTarget.style.height="3px"}
      >
        <div style={{ height:"100%",width:`${pct}%`,background:"var(--red)",borderRadius:"2px",transition:"width 0.4s" }}/>
      </div>

      {/* Controls */}
      <div style={{ display:"flex",alignItems:"center",gap:"4px" }}>
        <span style={{ fontSize:"11px",color:"var(--text3)",minWidth:"32px" }}>{fmtTime(ct)}</span>
        <button onClick={onPrev} disabled={!hasPrev} style={{ background:"none",border:"none",color:hasPrev?"#fff":"var(--text3)",fontSize:"14px",cursor:hasPrev?"pointer":"not-allowed",padding:"4px" }} title="Previous (←)">⏮</button>
        <button onClick={()=>{if(ref.current)ref.current.currentTime=Math.max(0,ref.current.currentTime-10);}} style={{ background:"none",border:"none",color:"#fff",fontSize:"14px",cursor:"pointer",padding:"4px" }}>⏪</button>
        <button onClick={()=>{if(ref.current){ref.current.paused?ref.current.play():ref.current.pause();}}} style={{ background:"var(--red)",border:"none",color:"#fff",fontSize:"16px",cursor:"pointer",width:"36px",height:"36px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 14px rgba(229,9,20,0.4)",flexShrink:0 }}>
          {playing?"⏸":"▶"}
        </button>
        <button onClick={()=>{if(ref.current)ref.current.currentTime=Math.min(ref.current.duration||0,ref.current.currentTime+10);}} style={{ background:"none",border:"none",color:"#fff",fontSize:"14px",cursor:"pointer",padding:"4px" }}>⏩</button>
        <button onClick={onNext} disabled={!hasNext&&loopMode!=="all"} style={{ background:"none",border:"none",color:(hasNext||loopMode==="all")?"#fff":"var(--text3)",fontSize:"14px",cursor:(hasNext||loopMode==="all")?"pointer":"not-allowed",padding:"4px" }} title="Next (N)">⏭</button>
        <div style={{ flex:1 }}/>
        {/* Loop mode */}
        <button onClick={()=>onLoopChange(loopMode==="none"?"one":loopMode==="one"?"all":"none")} title={`Loop: ${loopMode}`}
          style={{ background:loopMode!=="none"?"rgba(229,9,20,0.15)":"none",border:loopMode!=="none"?"1px solid rgba(229,9,20,0.3)":"none",color:loopMode!=="none"?"var(--red)":"var(--text3)",fontSize:"14px",cursor:"pointer",padding:"4px 6px",borderRadius:"6px" }}>
          {loopMode==="one"?"🔂":loopMode==="all"?"🔁":"➡"}
        </button>
        <button onClick={()=>setMuted(!isMuted)} style={{ background:"none",border:"none",color:"#fff",fontSize:"13px",cursor:"pointer" }}>
          {isMuted||volume===0?"🔇":volume<0.5?"🔉":"🔊"}
        </button>
        <input type="range" min="0" max="1" step="0.05" value={isMuted?0:volume}
          onChange={e=>{const v=parseFloat(e.target.value);setVolume(v);setMuted(v===0);if(ref.current)ref.current.volume=v;}}
          style={{ width:"60px",accentColor:"var(--red)",cursor:"pointer" }}
        />
        <span style={{ fontSize:"11px",color:"var(--text3)",minWidth:"32px",textAlign:"right" }}>{fmtTime(dur)}</span>
      </div>
    </div>
  );
}

function FBtn({ children, onClick, active, title }) {
  return (
    <button onClick={onClick} title={title} style={{ background:active?"rgba(229,9,20,0.2)":"rgba(255,255,255,0.05)",border:active?"1px solid rgba(229,9,20,0.4)":"1px solid rgba(255,255,255,0.08)",color:active?"var(--red)":"var(--text3)",borderRadius:"7px",width:"28px",height:"28px",cursor:"pointer",fontSize:"13px",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s" }}
      onMouseEnter={e=>{if(!active){e.currentTarget.style.background="rgba(255,255,255,0.1)";e.currentTarget.style.color="#fff";}}}
      onMouseLeave={e=>{if(!active){e.currentTarget.style.background="rgba(255,255,255,0.05)";e.currentTarget.style.color="var(--text3)";}}}
    >{children}</button>
  );
}

// ─── Audio Card ────────────────────────────────────────────────────
function AudioCard({ audio, isActive, onClick, onRemove, showNew }) {
  const [hovered, setHovered] = useState(false);
  const [albumArt, setAlbumArt] = useState(audio.albumArt||null);
  const [artError, setArtError] = useState(false);
  const artFetched = useRef(false);

  useEffect(()=>{
    if(albumArt||artFetched.current||!audio.file_path||artError) return;
    artFetched.current=true;
    fetch(`http://localhost:5000/api/album-art-generate?file_path=${encodeURIComponent(audio.file_path)}`)
      .then(r=>r.ok?r.json():null).then(d=>{ if(d?.url) setAlbumArt(d.url); }).catch(()=>{});
  },[audio.file_path]);

  return (
    <div onClick={onClick} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      style={{ display:"flex",alignItems:"center",gap:"12px",padding:"10px 14px",borderRadius:"10px",background:isActive?"rgba(229,9,20,0.08)":hovered?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.02)",border:`1px solid ${isActive?"rgba(229,9,20,0.3)":hovered?"rgba(255,255,255,0.1)":"var(--border)"}`,cursor:"pointer",transition:"all 0.15s",marginBottom:"4px",position:"relative" }}
    >
      {showNew&&<span style={{ position:"absolute",top:"-6px",left:"8px",background:"#3ddc84",color:"#000",fontSize:"8px",fontWeight:800,padding:"1px 6px",borderRadius:"4px" }}>NEW</span>}
      <div style={{ width:"46px",height:"46px",borderRadius:"8px",flexShrink:0,overflow:"hidden",position:"relative",background:isActive?"linear-gradient(135deg,rgba(229,9,20,0.4),rgba(229,9,20,0.15))":"rgba(255,255,255,0.06)",border:`1px solid ${isActive?"rgba(229,9,20,0.3)":"var(--border)"}`,display:"flex",alignItems:"center",justifyContent:"center" }}>
        {albumArt&&!artError?<img src={albumArt} alt="art" onError={()=>setArtError(true)} style={{ width:"100%",height:"100%",objectFit:"cover" }}/>:<span style={{ fontSize:"20px",opacity:isActive?1:0.5 }}>{isActive?"🔊":"🎵"}</span>}
        {isActive&&<div style={{ position:"absolute",inset:0,background:"rgba(229,9,20,0.15)",borderRadius:"8px",animation:"pulse 1.4s infinite" }}/>}
      </div>
      <div style={{ flex:1,overflow:"hidden" }}>
        <div style={{ fontSize:"13px",fontWeight:isActive?700:500,color:isActive?"#fff":"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{audio.title}</div>
        <div style={{ fontSize:"11px",color:"var(--text3)",marginTop:"2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
          {audio.artist&&<span style={{ color:isActive?"rgba(229,9,20,0.8)":"var(--text3)" }}>{audio.artist}</span>}
          {audio.artist&&audio.album&&" · "}{audio.album||(audio.duration>0?fmtTime(audio.duration):"")}
        </div>
      </div>
      {audio.duration>0&&<span style={{ fontSize:"11px",color:"var(--text3)",flexShrink:0 }}>{fmtTime(audio.duration)}</span>}
      {isActive&&<span style={{ fontSize:"10px",color:"var(--red)",fontWeight:700,background:"rgba(229,9,20,0.15)",padding:"2px 8px",borderRadius:"4px",flexShrink:0 }}>PLAYING</span>}
      {onRemove&&<button onClick={e=>{e.stopPropagation();onRemove(audio);}} style={{ background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"14px",padding:"4px",borderRadius:"6px",flexShrink:0,opacity:hovered?1:0,transition:"opacity 0.15s" }} onMouseEnter={e=>e.currentTarget.style.color="#e50914"} onMouseLeave={e=>e.currentTarget.style.color="var(--text3)"}>🗑</button>}
    </div>
  );
}

// ─── Side Panel ────────────────────────────────────────────────────
function SidePanel({ title, subtitle, onClose, children, headerExtra }) {
  return (
    <div style={{ position:"fixed",top:0,right:0,bottom:0,width:"290px",background:"rgba(10,10,10,0.98)",border:"1px solid var(--border)",zIndex:400,display:"flex",flexDirection:"column",boxShadow:"-8px 0 40px rgba(0,0,0,0.8)",backdropFilter:"blur(20px)" }}>
      <div style={{ padding:"16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <div><div style={{ fontSize:"14px",fontWeight:700 }}>{title}</div>{subtitle&&<div style={{ fontSize:"11px",color:"var(--text3)" }}>{subtitle}</div>}</div>
        <div style={{ display:"flex",gap:"6px",alignItems:"center" }}>{headerExtra}<button onClick={onClose} style={{ background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"18px" }}>✕</button></div>
      </div>
      <div style={{ flex:1,overflowY:"auto",padding:"8px" }}>{children}</div>
    </div>
  );
}

// ─── Pages ────────────────────────────────────────────────────────
function HomePage({ onQueue, sortBy, sortDir, onURLOpen, onRemoveVideo, onPlayNext, onPlayAudio }) {
  const { videos, currentVideo, setCurrentVideo, openFolder, openFile, isLoading, history, audios, currentAudio, removeAudio } = useAppStore();
  const sorted = [...videos].sort((a,b)=>{
    if(sortBy==="name") return sortDir==="asc"?a.title.localeCompare(b.title):b.title.localeCompare(a.title);
    if(sortBy==="duration") return sortDir==="asc"?(a.duration||0)-(b.duration||0):(b.duration||0)-(a.duration||0);
    if(sortBy==="size") return sortDir==="asc"?(a.size||0)-(b.size||0):(b.size||0)-(a.size||0);
    return 0;
  });
  const getProgress = v=>history.find(h=>h.file_path===(v.file_path||v.url))?.progress||0;
  return (
    <div style={{ flex:1,overflowY:"auto",padding:"24px 28px" }}>
      {/* VideoPlayer rendered in root App - not here */}
      <div style={{ display:"flex",gap:"10px",marginBottom:"26px",flexWrap:"wrap",alignItems:"center" }}>
        <Btn onClick={openFolder} primary icon="📂" loading={isLoading}>{isLoading?"Scanning...":"Open Folder"}</Btn>
        <Btn onClick={openFile} icon="🎬">Open File</Btn>
        <Btn onClick={onURLOpen} icon="🌐">Network URL</Btn>
        {(videos.length>0||audios.length>0)&&<span style={{ fontSize:"12px",color:"var(--text3)" }}>{videos.length>0&&`${videos.length} video${videos.length!==1?"s":""}`}{videos.length>0&&audios.length>0&&" · "}{audios.length>0&&`${audios.length} track${audios.length!==1?"s":""}`}</span>}
      </div>
      {history.length>0&&<Section title="Continue Watching" count={history.length}><Grid>{history.slice(0,6).map(h=>{ const v=videos.find(v=>v.file_path===h.file_path)||{id:h.id,title:h.title,url:h.file_path,file_path:h.file_path,duration:h.duration}; return <VideoCard key={h.id} video={v} isActive={currentVideo?.file_path===h.file_path} onClick={()=>setCurrentVideo(v)} onQueue={onQueue} progress={h.progress}/>; })}</Grid></Section>}
      {sorted.length>0?<Section title="Videos" count={sorted.length}><Grid>{sorted.map(v=><VideoCard key={v.id||v.file_path} video={v} isActive={currentVideo?.id===v.id} onClick={()=>{ setCurrentVideo(v); addToRecent(v); }} onQueue={onQueue} onRemove={onRemoveVideo} progress={getProgress(v)} showNew={isNew(v.addedAt)}/>)}</Grid></Section>:<Empty icon="🎬" title="No videos yet" desc="Open a folder, paste a URL, or drag & drop video files here." hint="Supports MP4, MKV, AVI, MOV, WebM and more" actions={<><Btn onClick={openFolder} primary icon="📂">Open Folder</Btn><Btn onClick={onURLOpen} icon="🌐">Network URL</Btn></>}/>}
      {audios.length>0&&<Section title="Audio Tracks" count={audios.length}>{audios.slice(0,8).map(a=><AudioCard key={a.id||a.file_path} audio={a} isActive={currentAudio?.id===a.id} onClick={()=>onPlayAudio(a)} onRemove={removeAudio} showNew={isNew(a.addedAt)}/>)}</Section>}
    </div>
  );
}

function VideosPage({ onQueue, sortBy, sortDir, onRemove }) {
  const { videos, currentVideo, setCurrentVideo, searchResults, searchQuery, history, openFolder, isLoading } = useAppStore();
  const display = searchQuery?searchResults.filter(v=>!v.isAudio):videos;
  const sorted = [...display].sort((a,b)=>{ if(sortBy==="name") return sortDir==="asc"?a.title.localeCompare(b.title):b.title.localeCompare(a.title); if(sortBy==="duration") return sortDir==="asc"?(a.duration||0)-(b.duration||0):(b.duration||0)-(a.duration||0); if(sortBy==="size") return sortDir==="asc"?(a.size||0)-(b.size||0):(b.size||0)-(a.size||0); return 0; });
  const getProgress=v=>history.find(h=>h.file_path===(v.file_path||v.url))?.progress||0;
  return (
    <div style={{ flex:1,overflowY:"auto",padding:"24px 28px" }}>
      <Section title={searchQuery?`Results for "${searchQuery}"`:"All Videos"} count={sorted.length} action={<Btn onClick={openFolder} primary icon="📂" small loading={isLoading}>{isLoading?"...":"Open Folder"}</Btn>}>
        {sorted.length>0?<Grid>{sorted.map(v=><VideoCard key={v.id||v.file_path} video={v} isActive={currentVideo?.file_path===v.file_path} onClick={()=>{ setCurrentVideo(v); addToRecent(v); }} onQueue={onQueue} onRemove={onRemove} progress={getProgress(v)} showNew={isNew(v.addedAt)}/>)}</Grid>:<Empty icon="🎬" title={searchQuery?"No results found":"No videos yet"} desc={searchQuery?`Nothing matched "${searchQuery}"`:"Open a folder to load your video library."} hint={!searchQuery?"Drag & drop files here too":""} actions={!searchQuery&&<Btn onClick={openFolder} primary icon="📂">Open Folder</Btn>}/>}
      </Section>
    </div>
  );
}

function AudioPage({ onPlayAudio }) {
  const { audios, currentAudio, removeAudio, openFolder, isLoading } = useAppStore();
  const [sortBy, setSortBy] = useState("title");
  const [sortDir, setSortDir] = useState("asc");
  const sorted = [...audios].sort((a,b)=>{ if(sortBy==="title") return sortDir==="asc"?a.title.localeCompare(b.title):b.title.localeCompare(a.title); if(sortBy==="artist") return sortDir==="asc"?(a.artist||"").localeCompare(b.artist||""):(b.artist||"").localeCompare(a.artist||""); if(sortBy==="duration") return sortDir==="asc"?(a.duration||0)-(b.duration||0):(b.duration||0)-(a.duration||0); if(sortBy==="album") return sortDir==="asc"?(a.album||"").localeCompare(b.album||""):(b.album||"").localeCompare(a.album||""); return 0; });
  const handleSort=(f)=>{ if(sortBy===f) setSortDir(d=>d==="asc"?"desc":"asc"); else { setSortBy(f); setSortDir("asc"); } };
  const SB=({field,label})=><button onClick={()=>handleSort(field)} style={{ background:sortBy===field?"rgba(229,9,20,0.15)":"rgba(255,255,255,0.04)",border:sortBy===field?"1px solid rgba(229,9,20,0.35)":"1px solid var(--border)",color:sortBy===field?"#fff":"var(--text3)",borderRadius:"7px",padding:"4px 10px",fontSize:"11px",fontWeight:sortBy===field?600:400,cursor:"pointer" }}>{label} {sortBy===field?(sortDir==="asc"?"↑":"↓"):""}</button>;
  return (
    <div style={{ flex:1,overflowY:"auto",padding:"24px 28px" }}>
      <Section title="Audio Library" count={sorted.length} action={<div style={{ display:"flex",gap:"6px" }}><SB field="title" label="Title"/><SB field="artist" label="Artist"/><SB field="album" label="Album"/><SB field="duration" label="Duration"/><Btn onClick={openFolder} primary icon="📂" small loading={isLoading}>{isLoading?"...":"Open"}</Btn></div>}>
        {sorted.length>0?<div>{sorted.map(a=><AudioCard key={a.id||a.file_path} audio={a} isActive={currentAudio?.id===a.id} onClick={()=>onPlayAudio(a)} onRemove={removeAudio} showNew={isNew(a.addedAt)}/>)}</div>:<Empty icon="🎵" title="No audio files" desc="Open a folder containing MP3, FLAC, WAV, AAC or other audio files." hint="Album art and metadata are extracted automatically" actions={<Btn onClick={openFolder} primary icon="📂">Open Folder</Btn>}/>}
      </Section>
    </div>
  );
}

function HistoryPage() {
  const { history, setCurrentVideo, loadHistory, videos } = useAppStore();
  const [removingId, setRemovingId] = useState(null);
  useEffect(()=>{ loadHistory(); },[]);
  const removeEntry=async(e,h)=>{ e.stopPropagation(); setRemovingId(h.id); try{ await fetch(`http://localhost:5000/api/history/${h.id}`,{method:"DELETE"}); }catch{} await loadHistory(); setRemovingId(null); };
  const resolveVideo=h=>{ const found=videos.find(v=>v.file_path===h.file_path||v.url===h.file_path); if(found) return found; const isReal=h.file_path&&!h.file_path.startsWith("blob:"); return { id:h.id,title:h.title,file_path:h.file_path,folder_path:h.file_path?h.file_path.split(/[\\/]/).slice(0,-1).join("/"):null,filename:h.file_path?h.file_path.split(/[\\/]/).pop():null,url:isReal?`file://${h.file_path.replace(/\\/g,"/")}`:h.file_path,duration:h.duration }; };
  return (
    <div style={{ flex:1,overflowY:"auto",padding:"24px 28px" }}>
      <Section title="Continue Watching" count={history.length} action={history.length>0&&<button onClick={async()=>{await fetch("http://localhost:5000/api/history",{method:"DELETE"}).catch(()=>{});loadHistory();}} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid var(--border)",color:"var(--text3)",borderRadius:"7px",padding:"4px 12px",cursor:"pointer",fontSize:"11px" }}>Clear All</button>}>
        {history.length===0?<Empty icon="⏱" title="Nothing here yet" desc="Start watching a video and your progress will be saved here automatically."/>:(
          <div style={{ display:"flex",flexDirection:"column",gap:"4px" }}>
            {history.map(h=>{ const pct=h.duration>0?Math.min(100,(h.progress/h.duration)*100):0; const video=resolveVideo(h); const isBlob=h.file_path?.startsWith("blob:"); const isRem=removingId===h.id; const libVideo=videos.find(v=>v.file_path===h.file_path); const thumb=libVideo?.thumbnail;
              return (
                <div key={h.id} onClick={()=>{ if(!isBlob){ setCurrentVideo(video); addToRecent(video); } }} style={{ display:"flex",alignItems:"center",gap:"12px",padding:"12px 14px",borderRadius:"10px",background:"rgba(255,255,255,0.03)",border:"1px solid var(--border)",transition:"background 0.15s,opacity 0.2s",marginBottom:"4px",opacity:isRem?0.4:1,cursor:isBlob?"not-allowed":"pointer" }} onMouseEnter={e=>{ if(!isBlob) e.currentTarget.style.background="rgba(255,255,255,0.06)"; }} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.03)"}>
                  <div style={{ width:"68px",height:"42px",borderRadius:"7px",background:"var(--bg3)",flexShrink:0,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center" }}>{thumb?<img src={thumb} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} onError={e=>e.target.style.display="none"}/>:<span style={{ fontSize:"18px",opacity:0.3 }}>🎬</span>}</div>
                  <div style={{ flex:1,overflow:"hidden" }}><div style={{ fontSize:"13px",fontWeight:600,color:isBlob?"var(--text3)":"#fff",marginBottom:"5px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{h.title}{isBlob&&<span style={{ fontSize:"10px",color:"var(--text3)",marginLeft:"8px" }}>(reopen folder to resume)</span>}</div><div style={{ height:"3px",background:"rgba(255,255,255,0.08)",borderRadius:"2px" }}><div style={{ height:"100%",width:`${pct}%`,background:"var(--red)",borderRadius:"2px" }}/></div></div>
                  <div style={{ textAlign:"right",flexShrink:0,minWidth:"48px" }}><div style={{ fontSize:"12px",color:"var(--red)",fontWeight:600 }}>{Math.round(pct)}%</div><div style={{ fontSize:"10px",color:"var(--text3)",marginTop:"2px" }}>{new Date(h.last_watched*1000).toLocaleDateString()}</div></div>
                  <button onClick={e=>removeEntry(e,h)} disabled={isRem} style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"var(--text3)",borderRadius:"7px",width:"30px",height:"30px",cursor:"pointer",fontSize:"14px",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(229,9,20,0.15)";e.currentTarget.style.color="#e50914";}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.04)";e.currentTarget.style.color="var(--text3)";}}>
                    {isRem?"…":"🗑"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── #5 Theme definitions ───────────────────────────────────────────
const THEMES = [
  { id:"dark",   label:"Dark",           preview:"#080808" },
  { id:"amoled", label:"AMOLED Black",   preview:"#000000" },
  { id:"navy",   label:"Navy Blue",      preview:"#060d1a" },
  { id:"forest", label:"Forest Green",   preview:"#060f08" },
  { id:"purple", label:"Midnight Purple",preview:"#080612" },
];

function applyTheme(id) {
  document.documentElement.setAttribute("data-theme", id === "dark" ? "" : id);
  try { localStorage.setItem("ns_theme", id); } catch {}
}
function getSavedTheme() {
  try { return localStorage.getItem("ns_theme") || "dark"; } catch { return "dark"; }
}

// ── #2 Watch Together ──────────────────────────────────────────────
function WatchTogether({ currentVideo, onClose }) {
  const [roomId, setRoomId]   = useState("");
  const [joined, setJoined]   = useState(false);
  const [peers, setPeers]     = useState(1);
  const [status, setStatus]   = useState("idle");
  const wsRef = useRef(null);

  const createRoom = () => {
    const id = Math.random().toString(36).slice(2,8).toUpperCase();
    setRoomId(id); joinRoom(id);
  };

  const joinRoom = (id) => {
    const rid = id || roomId;
    if (!rid) return;
    setStatus("connecting");
    // Simple peer sync via BroadcastChannel (same device tabs) as fallback
    // For real multi-device: connect to ws://your-server/sync
    try {
      const bc = new BroadcastChannel(`ns_room_${rid}`);
      wsRef.current = bc;
      bc.onmessage = (e) => {
        if (e.data.type === "seek") {
          const v = document.getElementById("main-video");
          if (v && Math.abs(v.currentTime - e.data.time) > 1) v.currentTime = e.data.time;
        }
        if (e.data.type === "play")  { document.getElementById("main-video")?.play(); }
        if (e.data.type === "pause") { document.getElementById("main-video")?.pause(); }
        if (e.data.type === "peers") setPeers(e.data.count);
      };
      bc.postMessage({ type:"peers", count: peers + 1 });
      setJoined(true); setStatus("connected"); setRoomId(rid);
    } catch { setStatus("error"); }
  };

  const leaveRoom = () => {
    wsRef.current?.close?.();
    wsRef.current = null;
    setJoined(false); setStatus("idle"); setPeers(1);
  };

  // Sync video events when in a room
  useEffect(() => {
    if (!joined || !wsRef.current) return;
    const v = document.getElementById("main-video");
    if (!v) return;
    const onPlay  = () => wsRef.current?.postMessage({ type:"play" });
    const onPause = () => wsRef.current?.postMessage({ type:"pause" });
    const onSeek  = () => wsRef.current?.postMessage({ type:"seek", time: v.currentTime });
    v.addEventListener("play",  onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("seeked",onSeek);
    return () => { v.removeEventListener("play",onPlay); v.removeEventListener("pause",onPause); v.removeEventListener("seeked",onSeek); };
  }, [joined]);

  useEffect(() => () => leaveRoom(), []);

  return (
    <div className="glass-panel" style={{ position:"fixed",top:"60px",right:"20px",borderRadius:"16px",padding:"18px 20px",zIndex:480,width:"280px",animation:"fadeIn 0.15s ease" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px" }}>
        <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
          <span style={{ fontSize:"16px" }}>👥</span>
          <span style={{ fontSize:"13px",fontWeight:700,color:"#fff" }}>Watch Together</span>
        </div>
        <button onClick={onClose} style={{ background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"16px" }}>✕</button>
      </div>

      {!currentVideo && <p style={{ fontSize:"12px",color:"var(--text3)",margin:"0 0 12px" }}>Play a video first to sync with others.</p>}

      {!joined ? (
        <>
          <p style={{ fontSize:"12px",color:"var(--text3)",margin:"0 0 14px",lineHeight:1.6 }}>
            Create a room or join one. Share the Room ID with friends — works across browser tabs on the same device, or use a WebSocket server for remote sync.
          </p>
          <button onClick={createRoom} style={{ width:"100%",padding:"10px",background:"linear-gradient(135deg,var(--red),#c40812)",border:"none",color:"#fff",borderRadius:"9px",cursor:"pointer",fontSize:"13px",fontWeight:700,marginBottom:"10px",boxShadow:"0 4px 14px var(--red-glow)" }}>
            + Create Room
          </button>
          <div style={{ display:"flex",gap:"8px" }}>
            <input type="text" placeholder="Room ID..." value={roomId} onChange={e=>setRoomId(e.target.value.toUpperCase())} style={{ flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#fff",borderRadius:"8px",padding:"8px 10px",fontSize:"13px",outline:"none",fontFamily:"monospace" }}/>
            <button onClick={()=>joinRoom()} style={{ padding:"8px 14px",background:"rgba(255,255,255,0.08)",border:"1px solid var(--border)",color:"#fff",borderRadius:"8px",cursor:"pointer",fontSize:"12px",fontWeight:600 }}>Join</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ background:"rgba(255,255,255,0.04)",borderRadius:"10px",padding:"12px",marginBottom:"12px",textAlign:"center" }}>
            <div style={{ fontSize:"10px",color:"var(--text3)",marginBottom:"4px",letterSpacing:"0.08em" }}>ROOM ID</div>
            <div style={{ fontSize:"22px",fontWeight:800,color:"#fff",fontFamily:"monospace",letterSpacing:"0.1em" }}>{roomId}</div>
            <div style={{ fontSize:"11px",color:"var(--text3)",marginTop:"4px" }}>Share this with friends</div>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:"8px",marginBottom:"12px" }}>
            <div style={{ width:"8px",height:"8px",borderRadius:"50%",background:"#3ddc84",animation:"pulse 1.4s infinite",flexShrink:0 }}/>
            <span style={{ fontSize:"12px",color:"#3ddc84" }}>Connected · {peers} viewer{peers!==1?"s":""}</span>
          </div>
          <button onClick={()=>{ navigator.clipboard?.writeText(roomId); }} style={{ width:"100%",padding:"8px",background:"rgba(255,255,255,0.06)",border:"1px solid var(--border)",color:"#fff",borderRadius:"8px",cursor:"pointer",fontSize:"12px",marginBottom:"8px" }}>
            📋 Copy Room ID
          </button>
          <button onClick={leaveRoom} style={{ width:"100%",padding:"8px",background:"rgba(229,9,20,0.12)",border:"1px solid rgba(229,9,20,0.3)",color:"var(--red)",borderRadius:"8px",cursor:"pointer",fontSize:"12px",fontWeight:600 }}>
            Leave Room
          </button>
        </>
      )}
    </div>
  );
}

function SettingsPage() {
  const { volume, setVolume, isMuted, setMuted, history } = useAppStore();
  const [theme, setTheme] = useState(getSavedTheme());

  const handleTheme = (id) => { setTheme(id); applyTheme(id); };

  // #8 Export watch history as CSV
  const exportHistory = () => {
    if (!history.length) { alert("No history to export."); return; }
    const header = "Title,File Path,Progress (s),Duration (s),% Watched,Last Watched,Watch Count";
    const rows = history.map(h => {
      const pct = h.duration > 0 ? ((h.progress/h.duration)*100).toFixed(1) : "0";
      const date = new Date(h.last_watched*1000).toLocaleString();
      return [
        `"${(h.title||"").replace(/"/g,'""')}"`,
        `"${(h.file_path||"").replace(/"/g,'""')}"`,
        Math.floor(h.progress||0),
        Math.floor(h.duration||0),
        pct,
        `"${date}"`,
        h.watch_count||1,
      ].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `neurostream_history_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div style={{ flex:1,overflowY:"auto",padding:"24px 28px" }}>
      <Section title="Settings">
        <div style={{ maxWidth:"520px" }}>
          {[
            { label:"Default Volume", hint:"Startup volume level", content:(
              <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
                <input type="range" min="0" max="1" step="0.05" value={isMuted?0:volume} onChange={e=>{setVolume(parseFloat(e.target.value));setMuted(false);}} style={{ width:"180px",accentColor:"var(--red)" }}/>
                <span style={{ color:"var(--text2)",fontSize:"13px",width:"38px" }}>{Math.round(volume*100)}%</span>
              </div>
            )},
            { label:"Mute on Start", hint:"Start all videos muted", content:(
              <div onClick={()=>setMuted(!isMuted)} style={{ width:"44px",height:"24px",borderRadius:"12px",background:isMuted?"var(--red)":"rgba(255,255,255,0.1)",cursor:"pointer",position:"relative",transition:"background 0.2s" }}>
                <div style={{ position:"absolute",top:"3px",left:isMuted?"23px":"3px",width:"18px",height:"18px",borderRadius:"50%",background:"#fff",transition:"left 0.2s" }}/>
              </div>
            )},
            { label:"Picture-in-Picture", hint:"Use ⧉ button in video player", content:<span style={{ color:"var(--text3)",fontSize:"12px" }}>Available in player toolbar</span>},
            { label:"Notifications", hint:"OS alert on audio track change", content:(
              <button onClick={()=>Notification.requestPermission().then(p=>alert(`Permission: ${p}`))} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid var(--border)",color:"var(--text2)",borderRadius:"8px",padding:"6px 14px",cursor:"pointer",fontSize:"12px" }}>Request Permission</button>
            )},
            { label:"Keyboard Shortcuts", hint:"A=audio play, N=next, B=bookmark, P=PiP", content:<span style={{ color:"var(--text3)",fontSize:"12px" }}>Press ? anywhere</span>},
            { label:"Version", hint:"", content:<span style={{ color:"var(--text3)",fontSize:"13px" }}>NeuroStream AI v3.3.0</span>},
          ].map(({label,hint,content})=>(
            <div key={label} style={{ borderBottom:"1px solid var(--border)",padding:"18px 0" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"20px" }}>
                <div><div style={{ fontSize:"14px",fontWeight:600,color:"#fff",marginBottom:"2px" }}>{label}</div>{hint&&<div style={{ fontSize:"12px",color:"var(--text3)" }}>{hint}</div>}</div>
                <div style={{ display:"flex",alignItems:"center",gap:"10px",flexShrink:0 }}>{content}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* #5 Theme selector */}
      <Section title="Theme">
        <div style={{ display:"flex",gap:"12px",flexWrap:"wrap" }}>
          {THEMES.map(t=>(
            <div key={t.id} onClick={()=>handleTheme(t.id)}
              style={{ cursor:"pointer",borderRadius:"12px",overflow:"hidden",border:`2px solid ${theme===t.id?"var(--red)":"transparent"}`,transition:"border 0.2s",width:"100px" }}>
              <div style={{ height:"50px",background:t.preview,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px" }}>
                {theme===t.id?"✓":""}
              </div>
              <div style={{ padding:"6px 8px",background:"rgba(255,255,255,0.04)",fontSize:"11px",color:theme===t.id?"#fff":"var(--text3)",textAlign:"center",fontWeight:theme===t.id?600:400 }}>
                {t.label}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* #8 Export History */}
      <Section title="Data & Export">
        <div style={{ display:"flex",flexDirection:"column",gap:"12px",maxWidth:"520px" }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px",background:"rgba(255,255,255,0.02)",border:"1px solid var(--border)",borderRadius:"12px" }}>
            <div>
              <div style={{ fontSize:"14px",fontWeight:600,color:"#fff",marginBottom:"2px" }}>Export Watch History</div>
              <div style={{ fontSize:"12px",color:"var(--text3)" }}>{history.length} entries → downloads as CSV spreadsheet</div>
            </div>
            <button onClick={exportHistory}
              style={{ padding:"8px 18px",background:"linear-gradient(135deg,var(--red),#c40812)",border:"none",color:"#fff",borderRadius:"9px",cursor:"pointer",fontSize:"12px",fontWeight:700,boxShadow:"0 4px 14px var(--red-glow)",flexShrink:0 }}>
              📥 Export CSV
            </button>
          </div>
        </div>
      </Section>

      {/* Build guide */}
      <Section title="Build & Install">
        <div style={{ background:"rgba(255,255,255,0.02)",border:"1px solid var(--border)",borderRadius:"12px",padding:"18px 20px" }}>
          <p style={{ margin:"0 0 12px",fontSize:"13px",color:"var(--text2)",lineHeight:1.6 }}>Build a standalone <code style={{ background:"rgba(255,255,255,0.06)",padding:"1px 6px",borderRadius:"4px",fontSize:"12px" }}>.exe</code> installer:</p>
          {["cd frontend && npm run build","cd ../electron && npm run build:win"].map(cmd=>(
            <div key={cmd} style={{ background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",padding:"10px 14px",marginBottom:"8px",fontFamily:"monospace",fontSize:"12px",color:"#3ddc84",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <span>{cmd}</span>
              <button onClick={()=>navigator.clipboard?.writeText(cmd)} style={{ background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"11px" }} title="Copy">📋</button>
            </div>
          ))}
          <p style={{ margin:"8px 0 0",fontSize:"11px",color:"var(--text3)" }}>Output → <code style={{ fontSize:"11px" }}>electron/dist-build/</code></p>
        </div>
      </Section>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────
export default function App() {
  const { currentPage,setPage,loadHistory,setCurrentVideo,setVideos,videos,currentVideo,removeVideo,currentAudio,setCurrentAudio,audios,removeAudio,restoreLastFolder,isRestoring,folderPath } = useAppStore();

  const [showShortcuts,setShowShortcuts] = useState(false);
  const [toast,setToast]           = useState(null);
  const [queue,setQueue]           = useState([]);
  const [showQueue,setShowQueue]   = useState(false);
  const [showPlaylist,setShowPlaylist] = useState(false);
  const [shuffle,setShuffle]       = useState(false);
  const [loopMode,setLoopMode]     = useState("none");
  const [sortBy,setSortBy]         = useState("date");
  const [sortDir,setSortDir]       = useState("desc");
  const [isDragOver,setIsDragOver] = useState(false);
  const [showNetworkURL,setShowNetworkURL] = useState(false);
  const [audioIdx,setAudioIdx]     = useState(0);

  // Feature panels
  const [showEQ,setShowEQ]           = useState(false);
  const [showSleep,setShowSleep]     = useState(false);
  const [showBookmarks,setShowBookmarks] = useState(false);
  const [showRecent,setShowRecent]   = useState(false);
  const [showLyrics,setShowLyrics]   = useState(false);
  const [showNotes,setShowNotes]     = useState(false);
  const [showWatchTogether,setShowWatchTogether] = useState(false);

  const videoElRef = useRef(null);

  const showMini       = currentVideo && currentPage !== "home";
  const showAudioPlayer = !!currentAudio;
  const showToast = useCallback(msg=>setToast(msg),[]);

  useEffect(()=>{ 
    loadHistory(); 
    restoreLastFolder(); 
    Notification.requestPermission?.();
    // #5 Apply saved theme on startup
    applyTheme(getSavedTheme());
  },[]);

  // Global keyboard shortcuts
  useEffect(()=>{
    const h=e=>{
      const tag=document.activeElement?.tagName;
      if(tag==="INPUT"||tag==="SELECT"||tag==="TEXTAREA") return;
      if(e.key==="?") setShowShortcuts(s=>!s);
      if(e.key==="Escape"&&showShortcuts) setShowShortcuts(false);
      if(e.key==="b"||e.key==="B") setShowBookmarks(s=>!s);
    };
    window.addEventListener("keydown",h);
    return ()=>window.removeEventListener("keydown",h);
  },[showShortcuts]);

  const handleSort=field=>{ if(sortBy===field) setSortDir(d=>d==="asc"?"desc":"asc"); else { setSortBy(field); setSortDir("asc"); } };
  const addToQueue=video=>{ setQueue(q=>q.find(v=>v.id===video.id)?q:[...q,video]); showToast(`Added "${video.title}" to queue`); };
  const playNext=useCallback(()=>{ const idx=videos.findIndex(v=>v.id===currentVideo?.id||v.file_path===currentVideo?.file_path); if(shuffle){ setCurrentVideo(videos[Math.floor(Math.random()*videos.length)]); return; } if(idx>=0&&idx<videos.length-1) setCurrentVideo(videos[idx+1]); },[videos,currentVideo,shuffle]);

  const playAudio=useCallback((audio)=>{ const idx=audios.findIndex(a=>a.id===audio.id||a.file_path===audio.file_path); setAudioIdx(idx>=0?idx:0); setCurrentAudio(audio); },[audios]);
  const playNextAudio=useCallback(()=>{ const next=audioIdx+1; if(next<audios.length){ setAudioIdx(next); setCurrentAudio(audios[next]); } },[audioIdx,audios]);
  const playPrevAudio=useCallback(()=>{ const prev=audioIdx-1; if(prev>=0){ setAudioIdx(prev); setCurrentAudio(audios[prev]); } },[audioIdx,audios]);

  // Sleep timer stop
  const handleSleepStop=()=>{
    const v=document.querySelector("video"); if(v) v.pause();
    const a=document.querySelector("audio"); if(a) a.pause();
    setCurrentAudio(null);
    showToast("😴 Sleep timer: playback stopped");
    setShowSleep(false);
  };

  const handleDrop=e=>{
    e.preventDefault(); setIsDragOver(false);
    const files=Array.from(e.dataTransfer.files);
    const videoExts=[".mp4",".mkv",".avi",".mov",".webm",".m4v",".flv"];
    const audioExts=[".mp3",".flac",".wav",".aac",".ogg",".m4a",".wma"];
    const vfiles=files.filter(f=>videoExts.some(x=>f.name.toLowerCase().endsWith(x)));
    const afiles=files.filter(f=>audioExts.some(x=>f.name.toLowerCase().endsWith(x)));
    if(vfiles.length){ const nv=vfiles.map((f,i)=>({id:Date.now()+i,title:f.name.replace(/\.[^.]+$/,""),filename:f.name,url:URL.createObjectURL(f),file_path:f.name,size:f.size,duration:0,addedAt:Date.now()})); setVideos([...videos,...nv]); setCurrentVideo(nv[0]); setPage("home"); showToast(`Loaded ${vfiles.length} video${vfiles.length>1?"s":""}`); }
    if(afiles.length){ const na=afiles.map((f,i)=>({id:Date.now()+1000+i,title:f.name.replace(/\.[^.]+$/,""),filename:f.name,url:URL.createObjectURL(f),file_path:f.name,size:f.size,isAudio:true,addedAt:Date.now()})); useAppStore.getState().setAudios([...audios,...na]); playAudio(na[0]); showToast(`Loaded ${afiles.length} audio track${afiles.length>1?"s":""}`); }
    if(!vfiles.length&&!afiles.length) showToast("No supported media files found");
  };

  const renderPage=()=>{
    switch(currentPage){
      case "home":     return <HomePage onQueue={addToQueue} sortBy={sortBy} sortDir={sortDir} onURLOpen={()=>setShowNetworkURL(true)} onRemoveVideo={removeVideo} onPlayNext={playNext} onPlayAudio={playAudio}/>;
      case "videos":   return <VideosPage onQueue={addToQueue} sortBy={sortBy} sortDir={sortDir} onRemove={removeVideo}/>;
      case "audio":    return <AudioPage onPlayAudio={playAudio}/>;
      case "together": return <div style={{flex:1,overflowY:"auto",padding:"24px 28px"}}><WatchTogether currentVideo={currentVideo} onClose={()=>setPage("home")}/></div>;
      case "youtube":  return <YoutubePage/>;
      case "history":  return <HistoryPage/>;
      case "settings": return <SettingsPage/>;
      default:         return <HomePage onQueue={addToQueue} sortBy={sortBy} sortDir={sortDir} onURLOpen={()=>setShowNetworkURL(true)} onRemoveVideo={removeVideo} onPlayNext={playNext} onPlayAudio={playAudio}/>;
    }
  };

  const showYtPlayer = !!useAppStore.getState().ytTrack;
  const bottomOffset = showMini || showAudioPlayer ? (showYtPlayer ? "170px" : "90px") : (showYtPlayer ? "90px" : "28px");

  return (
    <div onDragOver={e=>{e.preventDefault();setIsDragOver(true);}} onDragLeave={()=>setIsDragOver(false)} onDrop={handleDrop}
      style={{ display:"flex",flexDirection:"column",height:"100vh",background:"var(--bg)",color:"var(--text)",fontFamily:"'Segoe UI',system-ui,-apple-system,sans-serif",overflow:"hidden",outline:isDragOver?"3px dashed var(--red)":"3px solid transparent",transition:"outline 0.15s" }}>

      {isDragOver&&<div style={{ position:"fixed",inset:0,background:"rgba(229,9,20,0.07)",zIndex:800,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)",pointerEvents:"none" }}><div style={{ fontSize:"20px",fontWeight:700,color:"var(--red)",background:"rgba(0,0,0,0.85)",padding:"20px 36px",borderRadius:"16px",border:"2px dashed var(--red)" }}>📂 Drop videos or audio to play</div></div>}

      <TitleBar onSort={handleSort} sortBy={sortBy} sortDir={sortDir}/>

      {isRestoring&&<div style={{ position:"fixed",top:"48px",left:"50%",transform:"translateX(-50%)",background:"rgba(14,14,14,0.97)",border:"1px solid rgba(229,9,20,0.3)",borderRadius:"10px",padding:"10px 20px",display:"flex",alignItems:"center",gap:"10px",zIndex:300,boxShadow:"0 4px 24px rgba(0,0,0,0.8)",backdropFilter:"blur(16px)" }}><div style={{ width:"14px",height:"14px",border:"2px solid rgba(229,9,20,0.3)",borderTopColor:"var(--red)",borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0 }}/><span style={{ fontSize:"13px",color:"#fff" }}>Restoring <span style={{ color:"var(--red)" }}>{folderPath?.split(/[\\/]/).pop()}</span>...</span></div>}

      <div style={{ display:"flex",flex:1,overflow:"hidden" }}>
        <Sidebar/>
        <div style={{ flex:1,overflow:"hidden",display:"flex",flexDirection:"column" }}>
          {/* VideoPlayer lives here permanently — never unmounts — one video element always */}
          {currentVideo && (
            <div style={{
              padding:"24px 28px 0",
              display: currentPage==="home" ? "block" : "none",
            }}>
              <Section title="Now Playing">
                <VideoPlayer
                  onClose={()=>useAppStore.getState().setCurrentVideo(null)}
                  onPlayNext={playNext}
                  onBookmark={()=>setShowBookmarks(true)}
                />
              </Section>
            </div>
          )}
          {renderPage()}
        </div>
      </div>

      {showMini&&<MiniPlayer onExpand={()=>setPage("home")}/>}

      {showAudioPlayer&&(
        <AudioPlayer audio={currentAudio} onClose={()=>setCurrentAudio(null)} onNext={playNextAudio} onPrev={playPrevAudio} hasNext={audioIdx<audios.length-1} hasPrev={audioIdx>0} loopMode={loopMode} onLoopChange={setLoopMode} showEQ={showEQ} onToggleEQ={()=>setShowEQ(s=>!s)} showLyrics={showLyrics} onToggleLyrics={()=>setShowLyrics(s=>!s)} showNotes={showNotes} onToggleNotes={()=>setShowNotes(s=>!s)}/>
      )}

      {/* Feature Panels */}
      {showEQ && <Equalizer onClose={()=>setShowEQ(false)}/>}
      {showSleep && <SleepTimer onStop={handleSleepStop} onClose={()=>setShowSleep(false)}/>}
      {showBookmarks && currentVideo && (
        <VideoBookmarks videoId={currentVideo.id||currentVideo.file_path} videoTitle={currentVideo.title}
          getCurrentTime={()=>document.getElementById("main-video")?.currentTime||0}
          onSeek={t=>{ const v=document.getElementById("main-video"); if(v) v.currentTime=t; }}
          onClose={()=>setShowBookmarks(false)}
        />
      )}
      {showRecent&&<RecentFiles onPlay={v=>{ setCurrentVideo(v); setPage("home"); }} onClose={()=>setShowRecent(false)}/>}
      {showLyrics&&currentAudio&&<LyricsPanel track={currentAudio.title} artist={currentAudio.artist} onClose={()=>setShowLyrics(false)}/>}
      {showNotes&&currentVideo&&<VideoNotes videoId={currentVideo.id||currentVideo.file_path} videoTitle={currentVideo.title} getCurrentTime={()=>document.getElementById("main-video")?.currentTime||0} onClose={()=>setShowNotes(false)}/>}
      {showWatchTogether&&<WatchTogether currentVideo={currentVideo} onClose={()=>setShowWatchTogether(false)}/>}

      {/* FABs */}
      <div style={{ position:"fixed",bottom:bottomOffset,right:"28px",display:"flex",gap:"8px",zIndex:490,transition:"bottom 0.3s",flexWrap:"wrap",justifyContent:"flex-end",maxWidth:"400px" }}>
        <FBtn onClick={()=>setShowRecent(s=>!s)} active={showRecent} title="Recent Files">🕐</FBtn>
        <FBtn onClick={()=>setShowSleep(s=>!s)} active={showSleep} title="Sleep Timer">😴</FBtn>
        <FBtn onClick={()=>setShowWatchTogether(s=>!s)} active={showWatchTogether} title="Watch Together">👥</FBtn>
        {currentVideo&&<FBtn onClick={()=>setShowBookmarks(s=>!s)} active={showBookmarks} title="Bookmarks (B)">🔖</FBtn>}
        {videos.length>0&&<button onClick={()=>setShowPlaylist(s=>!s)} style={{ background:showPlaylist?"rgba(229,9,20,0.2)":"rgba(14,14,14,0.97)",border:`1px solid ${showPlaylist?"rgba(229,9,20,0.4)":"var(--border)"}`,color:showPlaylist?"var(--red)":"#fff",borderRadius:"12px",padding:"8px 14px",cursor:"pointer",fontSize:"12px",fontWeight:600,display:"flex",alignItems:"center",gap:"7px",boxShadow:"0 4px 20px rgba(0,0,0,0.7)" }}>{shuffle?"🔀":"📋"} Playlist</button>}
        {queue.length>0&&<button onClick={()=>setShowQueue(s=>!s)} style={{ background:"rgba(14,14,14,0.97)",border:"1px solid var(--border)",color:"#fff",borderRadius:"12px",padding:"8px 14px",cursor:"pointer",fontSize:"12px",fontWeight:600,display:"flex",alignItems:"center",gap:"7px",boxShadow:"0 4px 20px rgba(0,0,0,0.7)" }}><span style={{ background:"var(--red)",borderRadius:"6px",padding:"1px 7px",fontSize:"11px" }}>{queue.length}</span>Queue</button>}
      </div>

      {/* Playlist panel */}
      {showPlaylist&&(
        <SidePanel title="Playlist" subtitle={`${videos.length} videos`} onClose={()=>setShowPlaylist(false)}
          headerExtra={<button onClick={()=>{setShuffle(s=>!s);showToast(shuffle?"Shuffle off":"Shuffle on");}} style={{ display:"flex",alignItems:"center",gap:"5px",padding:"5px 10px",borderRadius:"7px",border:`1px solid ${shuffle?"rgba(229,9,20,0.4)":"var(--border)"}`,background:shuffle?"rgba(229,9,20,0.12)":"rgba(255,255,255,0.04)",color:shuffle?"var(--red)":"var(--text3)",cursor:"pointer",fontSize:"11px",fontWeight:600 }}>🔀 {shuffle?"ON":"OFF"}</button>}
        >
          {videos.map((v,i)=>{ const isCur=currentVideo?.id===v.id||currentVideo?.file_path===v.file_path; return <div key={v.id||i} onClick={()=>{setCurrentVideo(v);setPage("home");}} style={{ display:"flex",alignItems:"center",gap:"10px",padding:"9px 10px",borderRadius:"8px",marginBottom:"2px",background:isCur?"rgba(229,9,20,0.1)":"transparent",border:isCur?"1px solid rgba(229,9,20,0.25)":"1px solid transparent",cursor:"pointer",transition:"background 0.15s" }} onMouseEnter={e=>{if(!isCur)e.currentTarget.style.background="rgba(255,255,255,0.04)";}} onMouseLeave={e=>{if(!isCur)e.currentTarget.style.background="transparent";}}><span style={{ width:"20px",fontSize:"11px",color:isCur?"var(--red)":"var(--text3)",textAlign:"center",flexShrink:0 }}>{isCur?"▶":i+1}</span><div style={{ flex:1,overflow:"hidden" }}><div style={{ fontSize:"12px",fontWeight:isCur?700:400,color:isCur?"#fff":"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{v.title}</div>{v.duration>0&&<div style={{ fontSize:"10px",color:"var(--text3)" }}>{fmtTime(v.duration)}</div>}</div></div>; })}
        </SidePanel>
      )}

      {/* Queue panel */}
      {showQueue&&(
        <SidePanel title="Queue" subtitle={`${queue.length} video${queue.length!==1?"s":""}`} onClose={()=>setShowQueue(false)} headerExtra={queue.length>0&&<button onClick={()=>setQueue([])} style={{ background:"rgba(255,255,255,0.06)",border:"1px solid var(--border)",color:"var(--text3)",borderRadius:"7px",padding:"4px 10px",cursor:"pointer",fontSize:"11px" }}>Clear</button>}>
          {queue.length===0?<div style={{ padding:"40px 20px",textAlign:"center",color:"var(--text3)",fontSize:"13px" }}>Queue is empty.<br/>Right-click a video card to add.</div>:queue.map((v,i)=><div key={v.id||i} onClick={()=>{setCurrentVideo(v);setPage("home");setShowQueue(false);}} style={{ display:"flex",alignItems:"center",gap:"10px",padding:"10px",borderRadius:"9px",marginBottom:"4px",cursor:"pointer",transition:"background 0.15s" }} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}><div style={{ width:"22px",flexShrink:0,fontSize:"11px",color:"var(--text3)",textAlign:"center" }}>{i+1}</div><div style={{ flex:1,overflow:"hidden" }}><div style={{ fontSize:"12px",fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{v.title}</div>{v.duration>0&&<div style={{ fontSize:"10px",color:"var(--text3)" }}>{fmtTime(v.duration)}</div>}</div><button onClick={e=>{e.stopPropagation();setQueue(q=>q.filter((_,idx)=>idx!==i));}} style={{ background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"14px",padding:"2px 4px" }} onMouseEnter={e=>e.currentTarget.style.color="#fff"} onMouseLeave={e=>e.currentTarget.style.color="var(--text3)"}>✕</button></div>)}
        </SidePanel>
      )}

      <YoutubeMiniPlayer/>
      {showNetworkURL&&<NetworkURLPlayer onClose={()=>setShowNetworkURL(false)}/>}
      {toast&&<Toast message={toast} onDone={()=>setToast(null)}/>}
      {showShortcuts&&<ShortcutsOverlay onClose={()=>setShowShortcuts(false)}/>}
      <VoiceAssistant/>
    </div>
  );
}