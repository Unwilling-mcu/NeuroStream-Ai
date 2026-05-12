import { useState, useEffect, useRef, useCallback } from "react";

// Web Audio API equalizer with 10 bands
// Works by connecting audio elements through a chain of BiquadFilterNodes

const BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const BAND_LABELS = ["32Hz","64Hz","125Hz","250Hz","500Hz","1kHz","2kHz","4kHz","8kHz","16kHz"];

const PRESETS = {
  "Flat":        [0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
  "Bass Boost":  [8,  7,  5,  2,  0,  0,  0,  0,  0,  0],
  "Treble Boost":[0,  0,  0,  0,  0,  2,  4,  6,  7,  8],
  "Pop":         [-1, 0,  3,  5,  4,  0, -1, -2, -2, -2],
  "Rock":        [4,  3,  1,  0, -1, -1,  2,  4,  5,  5],
  "Jazz":        [3,  2,  1,  2,  0,  1,  2,  3,  3,  2],
  "Classical":   [4,  3,  2,  1,  0,  0, -1, -2, -2, -3],
  "Hip-Hop":     [5,  4,  2,  1, -1, -1,  2,  3,  3,  2],
  "Electronic":  [5,  4,  2,  0, -1, -1,  3,  4,  5,  5],
  "Vocal":       [-2,-1,  0,  3,  5,  4,  3,  0, -1, -2],
};

// Global audio context and filter chain — shared across app
let audioCtx = null;
let filters = null;
let sourceMap = new WeakMap();

export function connectAudioElement(audioEl) {
  if (!audioEl || sourceMap.has(audioEl)) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      filters = BANDS.map((freq, i) => {
        const f = audioCtx.createBiquadFilter();
        f.type = i === 0 ? "lowshelf" : i === BANDS.length - 1 ? "highshelf" : "peaking";
        f.frequency.value = freq;
        f.gain.value = 0;
        f.Q.value = 1.4;
        return f;
      });
      // Chain filters together
      for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
      }
      filters[filters.length - 1].connect(audioCtx.destination);
    }
    const source = audioCtx.createMediaElementSource(audioEl);
    source.connect(filters[0]);
    sourceMap.set(audioEl, source);
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (e) {
    console.warn("EQ connect failed:", e.message);
  }
}

export function setEQBand(bandIndex, gainDb) {
  if (!filters || !filters[bandIndex]) return;
  filters[bandIndex].gain.value = gainDb;
}

export function setEQPreset(presetName) {
  const gains = PRESETS[presetName] || PRESETS["Flat"];
  gains.forEach((g, i) => setEQBand(i, g));
}

export default function Equalizer({ onClose }) {
  const [gains, setGains] = useState(Array(10).fill(0));
  const [preset, setPreset] = useState("Flat");
  const [enabled, setEnabled] = useState(true);

  const applyGains = useCallback((newGains) => {
    newGains.forEach((g, i) => setEQBand(i, enabled ? g : 0));
  }, [enabled]);

  const handlePreset = (name) => {
    const newGains = [...(PRESETS[name] || PRESETS["Flat"])];
    setPreset(name);
    setGains(newGains);
    applyGains(newGains);
  };

  const handleBand = (i, val) => {
    const newGains = [...gains];
    newGains[i] = parseFloat(val);
    setGains(newGains);
    setPreset("Custom");
    setEQBand(i, enabled ? parseFloat(val) : 0);
  };

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    gains.forEach((g, i) => setEQBand(i, next ? g : 0));
  };

  return (
    <div style={{
      position: "fixed", bottom: "100px", left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(10,10,10,0.98)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "18px", padding: "20px 24px",
      zIndex: 470, width: "600px",
      boxShadow: "0 16px 56px rgba(0,0,0,0.9)",
      backdropFilter: "blur(24px)",
      animation: "fadeIn 0.2s ease",
    }}>
      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px" }}>
        <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
          <span style={{ fontSize:"16px" }}>🎛</span>
          <span style={{ fontSize:"14px",fontWeight:700,color:"#fff" }}>Equalizer</span>
          {/* Enable toggle */}
          <div onClick={handleToggle} style={{ width:"36px",height:"20px",borderRadius:"10px",background:enabled?"var(--red)":"rgba(255,255,255,0.1)",cursor:"pointer",position:"relative",transition:"background 0.2s",marginLeft:"6px" }}>
            <div style={{ position:"absolute",top:"2px",left:enabled?"18px":"2px",width:"16px",height:"16px",borderRadius:"50%",background:"#fff",transition:"left 0.2s" }}/>
          </div>
          <span style={{ fontSize:"11px",color:enabled?"var(--red)":"var(--text3)" }}>{enabled?"ON":"OFF"}</span>
        </div>
        <button onClick={onClose} style={{ background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"18px" }}>✕</button>
      </div>

      {/* Presets */}
      <div style={{ display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"20px" }}>
        {Object.keys(PRESETS).map(p => (
          <button key={p} onClick={()=>handlePreset(p)}
            style={{ padding:"4px 12px",borderRadius:"16px",border:preset===p?"1px solid var(--red)":"1px solid rgba(255,255,255,0.1)",background:preset===p?"rgba(229,9,20,0.15)":"rgba(255,255,255,0.04)",color:preset===p?"#fff":"var(--text3)",fontSize:"11px",fontWeight:preset===p?600:400,cursor:"pointer",transition:"all 0.15s" }}>
            {p}
          </button>
        ))}
        <button onClick={()=>handlePreset("Flat")}
          style={{ padding:"4px 12px",borderRadius:"16px",border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"var(--text3)",fontSize:"11px",cursor:"pointer" }}>
          Reset
        </button>
      </div>

      {/* Sliders */}
      <div style={{ display:"flex",gap:"12px",alignItems:"flex-end",justifyContent:"center" }}>
        {BANDS.map((freq, i) => (
          <div key={freq} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"6px",flex:1 }}>
            {/* dB value */}
            <span style={{ fontSize:"10px",color:gains[i]>0?"var(--red)":gains[i]<0?"#4a9eff":"var(--text3)",fontWeight:600,minWidth:"28px",textAlign:"center" }}>
              {gains[i]>0?"+":""}{gains[i]}
            </span>
            {/* Vertical slider */}
            <div style={{ position:"relative",height:"100px",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <input
                type="range" min="-12" max="12" step="0.5"
                value={gains[i]}
                onChange={e=>handleBand(i, e.target.value)}
                disabled={!enabled}
                style={{
                  writingMode:"vertical-lr",
                  WebkitAppearance:"slider-vertical",
                  appearance:"slider-vertical",
                  width:"28px",height:"90px",
                  accentColor:"var(--red)",
                  cursor:enabled?"pointer":"not-allowed",
                  opacity:enabled?1:0.4,
                }}
              />
              {/* Center line */}
              <div style={{ position:"absolute",left:0,right:0,top:"50%",height:"1px",background:"rgba(255,255,255,0.08)",pointerEvents:"none" }}/>
            </div>
            {/* Frequency label */}
            <span style={{ fontSize:"9px",color:"var(--text3)",textAlign:"center" }}>{BAND_LABELS[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}