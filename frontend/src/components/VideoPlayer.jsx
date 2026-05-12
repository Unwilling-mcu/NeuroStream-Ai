import { useEffect, useRef, useState, useCallback } from "react";
import { useAppStore } from "../store/useAppStore";

function fmtTime(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const s = Math.floor(sec), h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = s%60;
  return h>0?`${h}:${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`:`${m}:${String(ss).padStart(2,"0")}`;
}
function fmtSize(b) {
  if (!b) return "—";
  return b>1e9?`${(b/1e9).toFixed(2)} GB`:`${(b/1e6).toFixed(1)} MB`;
}

const QUALITY_LEVELS = [
  {label:"4K",value:"2160p",note:"Ultra HD"},{label:"1440p",value:"1440p",note:"2K QHD"},
  {label:"1080p",value:"1080p",note:"Full HD"},{label:"720p",value:"720p",note:"HD"},
  {label:"480p",value:"480p",note:"SD"},{label:"360p",value:"360p",note:"Low"},
  {label:"240p",value:"240p",note:"Very Low"},{label:"144p",value:"144p",note:"Minimum"},
];

// #6 Aspect ratio presets
const ASPECT_MODES = [
  {label:"16:9",  value:"contain",    hint:"Standard widescreen"},
  {label:"Fill",  value:"cover",      hint:"Fill screen (may crop)"},
  {label:"4:3",   value:"contain43",  hint:"Classic TV ratio"},
  {label:"21:9",  value:"contain219", hint:"Ultrawide cinematic"},
  {label:"Stretch",value:"fill",      hint:"Stretch to fit"},
];

// #3 Speed remembered per video
const SPEED_KEY = "ns_speed";
function getSavedSpeed() { try { return parseFloat(localStorage.getItem(SPEED_KEY)||"1")||1; } catch { return 1; } }
function saveSpeed(r) { try { localStorage.setItem(SPEED_KEY, r); } catch {} }

function resolveQ(res) {
  if (!res||res==="Unknown") return null;
  const h=parseInt(res.split("x")[1]||0);
  if(h>=2160) return "2160p"; if(h>=1440) return "1440p"; if(h>=1080) return "1080p";
  if(h>=720) return "720p"; if(h>=480) return "480p"; if(h>=360) return "360p";
  if(h>=240) return "240p"; return "144p";
}

export default function VideoPlayer({ onClose, onPlayNext, onBookmark }) {
  const { currentVideo, volume, isMuted, setVolume, setMuted, saveProgress, videos } = useAppStore();

  const videoRef      = useRef(null);
  const containerRef  = useRef(null);
  const progressRef   = useRef(null);
  const subtitleRef   = useRef(null);
  const hideTimer     = useRef(null);
  const autoplayTimer = useRef(null);

  const [playing,    setPlaying]    = useState(false);
  const [ct,         setCT]         = useState(0);
  const [duration,   setDuration]   = useState(0);
  const [buffered,   setBuffered]   = useState(0);
  const [showCtrl,   setShowCtrl]   = useState(true);
  const [isFS,       setIsFS]       = useState(false);
  const [isPiP,      setIsPiP]      = useState(false);
  // #3 load saved speed
  const [rate,       setRate]       = useState(getSavedSpeed());
  const [brightness, setBrightness] = useState(100);
  const [zoom,       setZoom]       = useState("contain");
  const [panel,      setPanel]      = useState(null);
  const [subUrl,     setSubUrl]     = useState(null);
  const [subLabel,   setSubLabel]   = useState(null);
  const [subOn,      setSubOn]      = useState(true);
  // #7 subtitle style
  const [subSize,    setSubSize]    = useState(100);   // percent
  const [subColor,   setSubColor]   = useState("#ffffff");
  const [vInfo,      setVInfo]      = useState({w:0,h:0,res:null,nq:null});
  const [quality,    setQuality]    = useState(null);
  const [chapters,   setChapters]   = useState([]);
  const [hovCh,      setHovCh]      = useState(null);
  const [shotMsg,    setShotMsg]    = useState(null);
  const [autoNext,   setAutoNext]   = useState(true);
  const [nextBanner, setNextBanner] = useState(false);

  const showControls = useCallback(() => {
    setShowCtrl(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowCtrl(false), 3000);
  }, []);

  // ── Load video ────────────────────────────────────────────────
  useEffect(() => {
    if (!currentVideo) return;
    const v = videoRef.current;
    if (!v) return;

    const currentSrc = v.src || "";
    const newUrl = currentVideo.url || "";
    const alreadyLoaded = currentSrc && (
      currentSrc === newUrl ||
      decodeURIComponent(currentSrc) === decodeURIComponent(newUrl)
    );

    if (alreadyLoaded && v.readyState >= 2) {
      setCT(v.currentTime); setDuration(v.duration||0); setPlaying(!v.paused);
      v.volume = isMuted ? 0 : volume; v.muted = isMuted;
      return;
    }

    setCT(0); setDuration(0); setBuffered(0);
    setPlaying(false); setPanel(null);
    setNextBanner(false); setChapters([]);
    clearTimeout(autoplayTimer.current);

    v.src = currentVideo.url;
    v.volume = isMuted ? 0 : volume;
    v.muted = isMuted;
    // #3 restore saved speed
    const savedRate = getSavedSpeed();
    setRate(savedRate);
    v.playbackRate = savedRate;

    const saved = parseFloat(sessionStorage.getItem(`ns_pos_${currentVideo.id||currentVideo.file_path}`)||"0");
    if (saved > 5) v.currentTime = saved;

    v.play().catch(()=>{});

    // Subtitle auto-detect
    setSubUrl(null); setSubLabel(null);
    if (currentVideo.filename && currentVideo.folder_path) {
      const u = `http://localhost:5000/api/subtitle/${encodeURIComponent(currentVideo.filename)}?folder=${encodeURIComponent(currentVideo.folder_path)}`;
      fetch(u,{method:"HEAD"}).then(r=>{if(r.ok){setSubUrl(u);setSubLabel("Auto");}}).catch(()=>{});
    }

    // Chapters
    if (currentVideo.file_path && !currentVideo.isNetwork) {
      fetch(`http://localhost:5000/api/chapters?file_path=${encodeURIComponent(currentVideo.file_path)}`)
        .then(r=>r.ok?r.json():[]).then(d=>setChapters(d||[])).catch(()=>{});
    }

    const nq = resolveQ(currentVideo.resolution);
    setQuality(nq);
    setVInfo({w:0,h:0,res:currentVideo.resolution,nq});

    return () => { clearTimeout(hideTimer.current); clearTimeout(autoplayTimer.current); };
  }, [currentVideo]);

  // Detect real dimensions
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const h = () => { const w=v.videoWidth,ht=v.videoHeight; if(w&&ht){const nq=resolveQ(`${w}x${ht}`);setVInfo({w,h:ht,res:`${w}x${ht}`,nq});setQuality(q=>q||nq);} };
    v.addEventListener("loadedmetadata",h);
    return ()=>v.removeEventListener("loadedmetadata",h);
  },[currentVideo]);

  useEffect(()=>{ const v=videoRef.current; if(!v) return; v.volume=isMuted?0:volume; v.muted=isMuted; },[volume,isMuted]);

  // Fullscreen + PiP listeners
  useEffect(()=>{ const h=()=>setIsFS(!!document.fullscreenElement); document.addEventListener("fullscreenchange",h); return ()=>document.removeEventListener("fullscreenchange",h); },[]);
  useEffect(()=>{
    const v=videoRef.current; if(!v) return;
    const onEnter=()=>setIsPiP(true), onLeave=()=>setIsPiP(false);
    v.addEventListener("enterpictureinpicture",onEnter);
    v.addEventListener("leavepictureinpicture",onLeave);
    return ()=>{ v.removeEventListener("enterpictureinpicture",onEnter); v.removeEventListener("leavepictureinpicture",onLeave); };
  },[currentVideo]);

  // Auto-play next
  const handleEnded = useCallback(()=>{
    setPlaying(false);
    if(currentVideo) saveProgress(currentVideo,duration,duration);
    if(!autoNext||!videos.length){onPlayNext?.();return;}
    const idx=videos.findIndex(v=>v.id===currentVideo?.id||v.file_path===currentVideo?.file_path);
    const next=idx>=0&&idx<videos.length-1?videos[idx+1]:null;
    if(next){ setNextBanner(true); autoplayTimer.current=setTimeout(()=>{setNextBanner(false);useAppStore.getState().setCurrentVideo(next);},5000); }
  },[autoNext,videos,currentVideo,duration]);

  const toggleFS = () => { if(!document.fullscreenElement) containerRef.current?.requestFullscreen(); else document.exitFullscreen(); };
  const togglePiP = useCallback(async()=>{ const v=videoRef.current; if(!v) return; try{ if(document.pictureInPictureElement) await document.exitPictureInPicture(); else await v.requestPictureInPicture(); }catch(e){console.warn("PiP:",e.message);} },[]);

  // #1 Keyboard shortcuts including B for bookmark
  useEffect(()=>{
    const handle=(e)=>{
      const v=videoRef.current; if(!v||!currentVideo) return;
      const tag=document.activeElement?.tagName;
      if(tag==="INPUT"||tag==="SELECT"||tag==="TEXTAREA") return;
      switch(e.key){
        case " ": case "k": e.preventDefault(); v.paused?v.play():v.pause(); break;
        case "ArrowRight": case "l": v.currentTime=Math.min(v.duration||0,v.currentTime+10); break;
        case "ArrowLeft":  case "j": v.currentTime=Math.max(0,v.currentTime-10); break;
        case "ArrowUp":   e.preventDefault(); { const nv=Math.min(1,volume+0.1); setVolume(nv); setMuted(false); v.volume=nv; } break;
        case "ArrowDown": e.preventDefault(); { const nv=Math.max(0,volume-0.1); setVolume(nv); v.volume=nv; } break;
        case "m": setMuted(!isMuted); break;
        case "f": toggleFS(); break;
        case "p": togglePiP(); break;
        case "s": takeScreenshot(); break;
        // #1 B key for bookmarks
        case "b": case "B": e.preventDefault(); onBookmark?.(v.currentTime); break;
        case ".": { const r=Math.min(3,rate+0.25); setRate(r); v.playbackRate=r; saveSpeed(r); } break;
        case ",": { const r=Math.max(0.25,rate-0.25); setRate(r); v.playbackRate=r; saveSpeed(r); } break;
        case "Escape": if(panel){setPanel(null);break;} if(isFS)toggleFS(); else onClose?.(); break;
      }
      showControls();
    };
    window.addEventListener("keydown",handle);
    return ()=>window.removeEventListener("keydown",handle);
  },[currentVideo,volume,isMuted,isFS,rate,panel,onBookmark]);

  const seek=(e)=>{ const v=videoRef.current,bar=progressRef.current; if(!v||!bar||!v.duration) return; const ratio=Math.max(0,Math.min(1,(e.clientX-bar.getBoundingClientRect().left)/bar.offsetWidth)); v.currentTime=ratio*v.duration; };

  const handleSubFile=(e)=>{ const f=e.target.files[0]; if(!f) return; setSubUrl(URL.createObjectURL(f)); setSubLabel(f.name); setSubOn(true); setPanel(null); };

  const takeScreenshot=async()=>{
    const v=videoRef.current; if(!v||!currentVideo) return;
    try{
      if(currentVideo.file_path&&!currentVideo.isNetwork){
        const r=await fetch(`http://localhost:5000/api/screenshot?file_path=${encodeURIComponent(currentVideo.file_path)}&time=${v.currentTime}`);
        if(r.ok){ const blob=await r.blob(); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`${currentVideo.title}_${Math.floor(v.currentTime)}s.png`; a.click(); setShotMsg("📸 Saved!"); setTimeout(()=>setShotMsg(null),2000); return; }
      }
      const c=document.createElement("canvas"); c.width=v.videoWidth; c.height=v.videoHeight; c.getContext("2d").drawImage(v,0,0);
      const a=document.createElement("a"); a.href=c.toDataURL("image/png"); a.download=`${currentVideo.title}_${Math.floor(v.currentTime)}s.png`; a.click();
      setShotMsg("📸 Saved!"); setTimeout(()=>setShotMsg(null),2000);
    }catch{ setShotMsg("❌ Failed"); setTimeout(()=>setShotMsg(null),2000); }
  };

  const selectQuality=(q)=>{ setQuality(q.value); setPanel(null); const blur={2160:"none",1440:"none",1080:"none",720:"none",480:"blur(0.3px)",360:"blur(0.6px)",240:"blur(1px)",144:"blur(1.8px)"}; if(videoRef.current) videoRef.current.style.filter=`brightness(${brightness}%) ${blur[parseInt(q.value)]||"none"}`; };

  // #7 apply subtitle styles via CSS custom property
  useEffect(()=>{
    const style = document.getElementById("ns-sub-style") || document.createElement("style");
    style.id = "ns-sub-style";
    style.textContent = `video::cue { font-size: ${subSize}% !important; color: ${subColor} !important; }`;
    document.head.appendChild(style);
  },[subSize,subColor]);

  // #6 compute actual objectFit from zoom mode
  const getObjectFit = () => {
    if(zoom==="contain"||zoom==="contain43"||zoom==="contain219") return "contain";
    if(zoom==="cover") return "cover";
    return "fill";
  };
  const getContainerStyle = () => {
    if(zoom==="contain43") return { aspectRatio:"4/3" };
    if(zoom==="contain219") return { aspectRatio:"21/9" };
    return {};
  };

  const pct    = duration>0?(ct/duration)*100:0;
  const bufPct = duration>0?(buffered/duration)*100:0;
  const nativeIdx = QUALITY_LEVELS.findIndex(q=>q.value===vInfo.nq);
  const availQ    = nativeIdx>=0?QUALITY_LEVELS.slice(nativeIdx):QUALITY_LEVELS;

  if (!currentVideo) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position:"relative", width:"100%", background:"#000",
        borderRadius:isFS?"0":"14px", overflow:"hidden",
        cursor:showCtrl?"default":"none",
        aspectRatio:"16/9",
        maxHeight:isFS?"100vh":"calc(100vh - 240px)",
        ...getContainerStyle(),
      }}
      onMouseMove={showControls}
      onMouseLeave={()=>setShowCtrl(false)}
      onMouseEnter={showControls}
      onClick={()=>panel&&setPanel(null)}
    >
      {/* VIDEO */}
      <video
        ref={videoRef}
        id="main-video"
        style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:getObjectFit(),background:"#000",display:"block",filter:`brightness(${brightness}%)` }}
        onClick={e=>{ e.stopPropagation(); if(panel){setPanel(null);return;} const v=videoRef.current; v&&(v.paused?v.play():v.pause()); showControls(); }}
        onDoubleClick={toggleFS}
        onPlay={()=>setPlaying(true)}
        onPause={()=>setPlaying(false)}
        onTimeUpdate={e=>{ const v=e.target; setCT(v.currentTime); sessionStorage.setItem(`ns_pos_${currentVideo?.id||currentVideo?.file_path}`,v.currentTime); const b=v.buffered; if(b.length>0) setBuffered(b.end(b.length-1)); if(Math.floor(v.currentTime)%5===0) saveProgress(currentVideo,v.currentTime,v.duration||0); }}
        onLoadedMetadata={e=>{ setDuration(e.target.duration); e.target.playbackRate=rate; setPlaying(true); }}
        onEnded={handleEnded}
        crossOrigin="anonymous"
      >
        {subUrl&&subOn&&<track key={subUrl} kind="subtitles" src={subUrl} default label={subLabel||"Sub"}/>}
      </video>

      {/* Screenshot msg */}
      {shotMsg&&<div style={{ position:"absolute",top:"14px",left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.85)",color:"#fff",padding:"7px 16px",borderRadius:"9px",fontSize:"13px",zIndex:30,border:"1px solid rgba(255,255,255,0.15)" }}>{shotMsg}</div>}

      {/* Auto-next banner */}
      {nextBanner&&(()=>{ const idx=videos.findIndex(v=>v.id===currentVideo?.id||v.file_path===currentVideo?.file_path); const next=idx>=0&&idx<videos.length-1?videos[idx+1]:null; return next?(<div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",background:"rgba(10,10,10,0.95)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"14px",padding:"20px 28px",textAlign:"center",zIndex:30 }}><div style={{ fontSize:"11px",color:"var(--text3)",marginBottom:"6px",letterSpacing:"0.08em" }}>UP NEXT IN 5 SECONDS</div><div style={{ fontSize:"15px",fontWeight:700,color:"#fff",marginBottom:"14px" }}>{next.title}</div><div style={{ display:"flex",gap:"8px",justifyContent:"center" }}><button onClick={()=>{clearTimeout(autoplayTimer.current);setNextBanner(false);useAppStore.getState().setCurrentVideo(next);}} style={{ background:"var(--red)",border:"none",color:"#fff",borderRadius:"8px",padding:"8px 18px",cursor:"pointer",fontSize:"13px",fontWeight:700 }}>Play Now</button><button onClick={()=>{clearTimeout(autoplayTimer.current);setNextBanner(false);}} style={{ background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#fff",borderRadius:"8px",padding:"8px 18px",cursor:"pointer",fontSize:"13px" }}>Cancel</button></div></div>):null; })()}

      {/* Bottom gradient */}
      <div style={{ position:"absolute",bottom:0,left:0,right:0,height:"200px",background:"linear-gradient(transparent,rgba(0,0,0,0.97))",pointerEvents:"none",opacity:showCtrl?1:0,transition:"opacity 0.3s" }}/>

      {/* ── CC PANEL ── #10 glass */}
      {panel==="cc"&&(
        <div onClick={e=>e.stopPropagation()} className="glass-panel" style={{ position:"absolute",bottom:"80px",right:"16px",borderRadius:"14px",padding:"16px",width:"240px",maxHeight:"72vh",overflowY:"auto",zIndex:50 }}>
          <PanelHdr title="Subtitles" onClose={()=>setPanel(null)}/>
          <POpt label="Off" active={!subOn} onClick={()=>{setSubOn(false);setPanel(null);}}/>
          {subUrl&&<POpt label={subLabel||"Loaded"} active={subOn} onClick={()=>{setSubOn(true);setPanel(null);}}/>}
          <div onClick={()=>subtitleRef.current?.click()} style={{ padding:"9px 12px",cursor:"pointer",fontSize:"13px",color:"var(--red)",display:"flex",alignItems:"center",gap:"8px",borderRadius:"7px",transition:"background 0.15s" }} onMouseEnter={e=>e.currentTarget.style.background="rgba(229,9,20,0.1)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            📂 Load .srt / .vtt file
          </div>
          {/* #7 Subtitle style controls */}
          <div style={{ borderTop:"1px solid rgba(255,255,255,0.08)",marginTop:"10px",paddingTop:"10px" }}>
            <div style={{ fontSize:"10px",color:"var(--text3)",letterSpacing:"0.08em",marginBottom:"8px" }}>SUBTITLE STYLE</div>
            <div style={{ display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px" }}>
              <span style={{ fontSize:"11px",color:"var(--text3)",width:"36px" }}>Size</span>
              <input type="range" min="60" max="200" step="10" value={subSize} onChange={e=>setSubSize(e.target.value)} style={{ flex:1,accentColor:"var(--red)" }}/>
              <span style={{ fontSize:"11px",color:"var(--text3)",width:"32px" }}>{subSize}%</span>
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
              <span style={{ fontSize:"11px",color:"var(--text3)",width:"36px" }}>Color</span>
              <div style={{ display:"flex",gap:"6px",flex:1,flexWrap:"wrap" }}>
                {["#ffffff","#ffff00","#00ff00","#ff6b6b","#4a9eff"].map(c=>(
                  <div key={c} onClick={()=>setSubColor(c)} style={{ width:"20px",height:"20px",borderRadius:"50%",background:c,cursor:"pointer",border:subColor===c?"2px solid #fff":"2px solid transparent",transition:"border 0.15s" }}/>
                ))}
              </div>
            </div>
          </div>
          <input ref={subtitleRef} type="file" accept=".srt,.vtt" style={{display:"none"}} onChange={handleSubFile}/>
        </div>
      )}

      {/* ── SETTINGS PANEL ── #10 glass */}
      {panel==="settings"&&(
        <div onClick={e=>e.stopPropagation()} className="glass-panel" style={{ position:"absolute",bottom:"80px",right:"16px",borderRadius:"14px",padding:"16px",width:"360px",maxHeight:"72vh",overflowY:"auto",zIndex:50 }}>
          <PanelHdr title="Settings" onClose={()=>setPanel(null)}/>

          {/* Video Info */}
          <PHdr>Video Info</PHdr>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"14px" }}>
            <IBox label="Resolution" value={vInfo.w&&vInfo.h?`${vInfo.w}×${vInfo.h}`:(vInfo.res||"Detecting…")}/>
            <IBox label="Quality" value={vInfo.nq||"—"} red/>
            <IBox label="Size" value={fmtSize(currentVideo.size)}/>
            <IBox label="Duration" value={duration>0?fmtTime(duration):"—"}/>
          </div>

          {/* Quality */}
          <PHdr>Quality</PHdr>
          <div style={{ display:"flex",flexWrap:"wrap",gap:"7px",margin:"8px 0 14px" }}>
            {availQ.map(q=>{ const isNative=q.value===vInfo.nq,isSel=q.value===quality; return <button key={q.value} onClick={()=>selectQuality(q)} style={{ padding:"5px 12px",borderRadius:"18px",border:isSel?"1.5px solid var(--red)":"1.5px solid rgba(255,255,255,0.12)",background:isSel?"rgba(229,9,20,0.18)":"rgba(255,255,255,0.04)",color:isSel?"#fff":"#aaa",fontSize:"12px",fontWeight:isSel?700:400,cursor:"pointer",position:"relative",transition:"all 0.15s" }}>{q.label}{isNative&&<span style={{ position:"absolute",top:"-7px",right:"-4px",background:"#3ddc84",color:"#000",fontSize:"7px",fontWeight:800,padding:"1px 4px",borderRadius:"3px" }}>NATIVE</span>}</button>; })}
          </div>

          {/* #6 Aspect Ratio */}
          <PHdr>Aspect Ratio</PHdr>
          <div style={{ display:"flex",gap:"6px",flexWrap:"wrap",margin:"8px 0 14px" }}>
            {ASPECT_MODES.map(a=>(
              <button key={a.value} onClick={()=>setZoom(a.value)} title={a.hint}
                style={{ padding:"5px 12px",borderRadius:"18px",border:zoom===a.value?"1.5px solid var(--red)":"1.5px solid rgba(255,255,255,0.12)",background:zoom===a.value?"rgba(229,9,20,0.18)":"rgba(255,255,255,0.04)",color:zoom===a.value?"#fff":"#aaa",fontSize:"12px",fontWeight:zoom===a.value?700:400,cursor:"pointer",transition:"all 0.15s" }}>
                {a.label}
              </button>
            ))}
          </div>

          {/* #3 Speed — saved per video */}
          <PHdr>Speed (remembered)</PHdr>
          <div style={{ display:"flex",flexWrap:"wrap",gap:"6px",margin:"8px 0 14px" }}>
            {[0.25,0.5,0.75,1,1.25,1.5,1.75,2,2.5,3].map(r=>(
              <button key={r} onClick={()=>{ setRate(r); if(videoRef.current) videoRef.current.playbackRate=r; saveSpeed(r); }}
                style={{ padding:"4px 11px",borderRadius:"14px",border:rate===r?"1.5px solid var(--red)":"1.5px solid rgba(255,255,255,0.1)",background:rate===r?"rgba(229,9,20,0.18)":"rgba(255,255,255,0.04)",color:rate===r?"#fff":"#888",fontSize:"11px",fontWeight:rate===r?700:400,cursor:"pointer" }}>
                {r===1?"Normal":`${r}x`}
              </button>
            ))}
          </div>

          {/* Brightness */}
          <PHdr>Brightness — {brightness}%</PHdr>
          <input type="range" min="40" max="160" step="5" value={brightness} onChange={e=>{ setBrightness(e.target.value); if(videoRef.current) videoRef.current.style.filter=`brightness(${e.target.value}%)`; }} style={{ width:"100%",accentColor:"#f5a623",margin:"8px 0 14px",cursor:"pointer" }}/>

          {/* Auto-next */}
          <PHdr>Auto-play Next</PHdr>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:"8px" }}>
            <span style={{ fontSize:"13px",color:"var(--text2)" }}>Play next video automatically</span>
            <Toggle value={autoNext} onChange={()=>setAutoNext(v=>!v)}/>
          </div>
        </div>
      )}

      {/* ── CONTROLS ── */}
      <div style={{ position:"absolute",bottom:0,left:0,right:0,padding:"16px 20px 14px",opacity:showCtrl?1:0,pointerEvents:showCtrl?"auto":"none",transition:"opacity 0.3s",zIndex:10 }}>
        {/* Title + badges */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px" }}>
          <span style={{ fontSize:"13px",fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"55%" }}>{currentVideo.title}</span>
          <div style={{ display:"flex",alignItems:"center",gap:"8px",flexShrink:0 }}>
            {quality&&<span style={{ fontSize:"10px",fontWeight:700,padding:"2px 7px",background:"rgba(229,9,20,0.2)",border:"1px solid rgba(229,9,20,0.4)",borderRadius:"4px",color:"var(--red)" }}>{quality}</span>}
            {rate!==1&&<span style={{ fontSize:"10px",color:"#f5a623",background:"rgba(245,166,35,0.15)",padding:"2px 7px",borderRadius:"4px",border:"1px solid rgba(245,166,35,0.3)" }}>{rate}x</span>}
            <span style={{ fontSize:"12px",color:"#aaa" }}>{fmtTime(ct)} / {fmtTime(duration)}</span>
          </div>
        </div>

        {/* Progress + chapters */}
        <div ref={progressRef} onClick={seek} style={{ height:"5px",background:"rgba(255,255,255,0.18)",borderRadius:"3px",marginBottom:"14px",cursor:"pointer",position:"relative" }} onMouseEnter={e=>e.currentTarget.style.height="7px"} onMouseLeave={e=>e.currentTarget.style.height="5px"}>
          <div style={{ position:"absolute",top:0,left:0,height:"100%",width:`${bufPct}%`,background:"rgba(255,255,255,0.25)",borderRadius:"3px" }}/>
          <div style={{ position:"absolute",top:0,left:0,height:"100%",width:`${pct}%`,background:"var(--red)",borderRadius:"3px" }}/>
          <div style={{ position:"absolute",top:"50%",left:`${pct}%`,transform:"translate(-50%,-50%)",width:"13px",height:"13px",background:"#fff",borderRadius:"50%",boxShadow:"0 0 6px rgba(0,0,0,0.8)" }}/>
          {chapters.map((ch,i)=>{ if(!duration||ch.start<=0) return null; const cp=(ch.start/duration)*100; return <div key={i} onClick={e=>{e.stopPropagation();if(videoRef.current)videoRef.current.currentTime=ch.start;}} onMouseEnter={()=>setHovCh(i)} onMouseLeave={()=>setHovCh(null)} style={{ position:"absolute",top:"50%",left:`${cp}%`,transform:"translate(-50%,-50%)",width:"3px",height:"12px",background:"rgba(255,255,255,0.7)",borderRadius:"2px",cursor:"pointer",zIndex:5 }}>{hovCh===i&&<div style={{ position:"absolute",bottom:"16px",left:"50%",transform:"translateX(-50%)",background:"rgba(10,10,10,0.95)",border:"1px solid rgba(255,255,255,0.12)",color:"#fff",fontSize:"10px",padding:"3px 8px",borderRadius:"5px",whiteSpace:"nowrap",pointerEvents:"none" }}>{ch.title}</div>}</div>; })}
        </div>

        {/* Buttons */}
        <div style={{ display:"flex",alignItems:"center",gap:"4px" }}>
          <CB onClick={()=>videoRef.current&&(videoRef.current.currentTime-=10)}>⏪</CB>
          <CB onClick={()=>{const v=videoRef.current;v&&(v.paused?v.play():v.pause());}} large>{playing?"⏸":"▶"}</CB>
          <CB onClick={()=>videoRef.current&&(videoRef.current.currentTime+=10)}>⏩</CB>
          <CB onClick={()=>setMuted(!isMuted)}>{isMuted||volume===0?"🔇":volume<0.5?"🔉":"🔊"}</CB>
          <input type="range" min="0" max="1" step="0.05" value={isMuted?0:volume} onChange={e=>{const val=parseFloat(e.target.value);setVolume(val);setMuted(val===0);if(videoRef.current)videoRef.current.volume=val;}} style={{ width:"70px",accentColor:"var(--red)",cursor:"pointer",flexShrink:0 }}/>
          <div style={{ flex:1 }}/>
          <CB onClick={takeScreenshot} title="Screenshot (S)">📸</CB>
          <CB onClick={e=>{e.stopPropagation();setPanel(p=>p==="cc"?null:"cc");}} active={panel==="cc"||(subUrl&&subOn)}>CC</CB>
          <CB onClick={e=>{e.stopPropagation();setPanel(p=>p==="settings"?null:"settings");}} active={panel==="settings"}>⚙</CB>
          <CB onClick={togglePiP} active={isPiP} title="Picture-in-Picture (P)">⧉</CB>
          <CB onClick={toggleFS} title="Fullscreen (F)">⛶</CB>
          {onClose&&<CB onClick={onClose}>✕</CB>}
        </div>
      </div>
    </div>
  );
}

function PanelHdr({title,onClose}){return(<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}><span style={{fontSize:"13px",fontWeight:700,color:"#fff"}}>{title}</span><button onClick={onClose} style={{background:"none",border:"none",color:"#666",cursor:"pointer",fontSize:"16px"}}>✕</button></div>);}
function POpt({label,active,onClick}){return(<div onClick={onClick} style={{padding:"9px 12px",borderRadius:"7px",cursor:"pointer",fontSize:"13px",color:active?"#fff":"#888",background:active?"rgba(229,9,20,0.15)":"transparent",display:"flex",alignItems:"center",gap:"8px",transition:"background 0.15s",marginBottom:"2px"}} onMouseEnter={e=>{if(!active)e.currentTarget.style.background="rgba(255,255,255,0.06)"}} onMouseLeave={e=>{e.currentTarget.style.background=active?"rgba(229,9,20,0.15)":"transparent"}}><span style={{color:active?"var(--red)":"transparent",fontSize:"11px",width:"12px"}}>✓</span>{label}</div>);}
function PHdr({children}){return(<div style={{fontSize:"10px",fontWeight:700,color:"#555",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"4px",borderBottom:"1px solid rgba(255,255,255,0.05)",paddingBottom:"4px"}}>{children}</div>);}
function IBox({label,value,red}){return(<div style={{background:"rgba(255,255,255,0.04)",borderRadius:"7px",padding:"7px 10px"}}><div style={{fontSize:"9px",color:"#555",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"2px"}}>{label}</div><div style={{fontSize:"12px",fontWeight:600,color:red?"var(--red)":"#fff"}}>{value}</div></div>);}
function Toggle({value,onChange}){return(<div onClick={onChange} style={{width:"44px",height:"24px",borderRadius:"12px",background:value?"var(--red)":"rgba(255,255,255,0.1)",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}><div style={{position:"absolute",top:"3px",left:value?"23px":"3px",width:"18px",height:"18px",borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.4)"}}/></div>);}
function CB({children,onClick,title,large,active}){return(<button onClick={onClick} title={title} style={{background:active?"rgba(229,9,20,0.2)":"none",border:active?"1px solid rgba(229,9,20,0.4)":"none",color:active?"var(--red)":"#fff",fontSize:large?"20px":"15px",cursor:"pointer",padding:"5px 8px",borderRadius:"7px",transition:"background 0.15s",lineHeight:1,flexShrink:0}} onMouseEnter={e=>{if(!active)e.currentTarget.style.background="rgba(255,255,255,0.1)"}} onMouseLeave={e=>{if(!active)e.currentTarget.style.background="none"}}>{children}</button>);}