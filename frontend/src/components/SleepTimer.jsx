import { useState, useEffect, useRef } from "react";

const PRESETS = [5, 10, 15, 20, 30, 45, 60, 90];

export default function SleepTimer({ onStop, onClose }) {
  const [minutes, setMinutes] = useState(30);
  const [remaining, setRemaining] = useState(null); // null = not started
  const [active, setActive] = useState(false);
  const intervalRef = useRef(null);

  const start = () => {
    setRemaining(minutes * 60);
    setActive(true);
  };

  const cancel = () => {
    clearInterval(intervalRef.current);
    setActive(false);
    setRemaining(null);
  };

  useEffect(() => {
    if (!active || remaining === null) return;
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setActive(false);
          onStop?.(); // pause all media
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [active]);

  const fmt = (secs) => {
    if (!secs) return "0:00";
    const m = Math.floor(secs / 60), s = secs % 60;
    return `${m}:${String(s).padStart(2,"0")}`;
  };

  const pct = remaining !== null ? (remaining / (minutes * 60)) * 100 : 100;

  return (
    <div style={{
      position: "fixed", top: "60px", right: "20px",
      background: "rgba(10,10,10,0.98)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "16px", padding: "18px 20px",
      zIndex: 480, width: "240px",
      boxShadow: "0 12px 40px rgba(0,0,0,0.9)",
      backdropFilter: "blur(20px)",
      animation: "fadeIn 0.15s ease",
    }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px" }}>
        <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
          <span style={{ fontSize:"16px" }}>😴</span>
          <span style={{ fontSize:"13px",fontWeight:700,color:"#fff" }}>Sleep Timer</span>
        </div>
        <button onClick={onClose} style={{ background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"16px" }}>✕</button>
      </div>

      {active ? (
        <>
          {/* Countdown */}
          <div style={{ textAlign:"center",marginBottom:"14px" }}>
            <div style={{ fontSize:"32px",fontWeight:800,color:"#fff",letterSpacing:"-0.02em" }}>{fmt(remaining)}</div>
            <div style={{ fontSize:"11px",color:"var(--text3)",marginTop:"4px" }}>remaining</div>
          </div>

          {/* Progress ring */}
          <div style={{ height:"4px",background:"rgba(255,255,255,0.08)",borderRadius:"2px",marginBottom:"14px" }}>
            <div style={{ height:"100%",width:`${pct}%`,background:"var(--red)",borderRadius:"2px",transition:"width 1s linear" }}/>
          </div>

          <button onClick={cancel} style={{ width:"100%",padding:"9px",background:"rgba(229,9,20,0.15)",border:"1px solid rgba(229,9,20,0.4)",color:"var(--red)",borderRadius:"9px",cursor:"pointer",fontSize:"13px",fontWeight:600 }}>
            Cancel Timer
          </button>
        </>
      ) : (
        <>
          {/* Preset buttons */}
          <div style={{ display:"flex",flexWrap:"wrap",gap:"6px",marginBottom:"14px" }}>
            {PRESETS.map(m=>(
              <button key={m} onClick={()=>setMinutes(m)}
                style={{ padding:"5px 10px",borderRadius:"8px",border:minutes===m?"1px solid var(--red)":"1px solid rgba(255,255,255,0.1)",background:minutes===m?"rgba(229,9,20,0.15)":"rgba(255,255,255,0.04)",color:minutes===m?"#fff":"var(--text3)",fontSize:"12px",cursor:"pointer",transition:"all 0.15s" }}>
                {m}m
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div style={{ display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px" }}>
            <input type="number" min="1" max="480" value={minutes} onChange={e=>setMinutes(parseInt(e.target.value)||1)}
              style={{ flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#fff",borderRadius:"8px",padding:"7px 10px",fontSize:"13px",outline:"none",width:"100%" }}
            />
            <span style={{ fontSize:"12px",color:"var(--text3)",flexShrink:0 }}>minutes</span>
          </div>

          <button onClick={start} style={{ width:"100%",padding:"9px",background:"linear-gradient(135deg,#e50914,#c40812)",border:"none",color:"#fff",borderRadius:"9px",cursor:"pointer",fontSize:"13px",fontWeight:700,boxShadow:"0 4px 14px rgba(229,9,20,0.3)" }}>
            Start Timer ({minutes}m)
          </button>
        </>
      )}
    </div>
  );
}