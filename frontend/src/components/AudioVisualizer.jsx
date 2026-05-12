import { useEffect, useRef, useState } from "react";

// Connects to the same AudioContext used by the Equalizer
// Falls back gracefully if Web Audio API is unavailable

let analyser = null;
let animFrame = null;

export function connectVisualizer(audioCtxRef) {
  // Called from Equalizer's shared audioCtx after source is connected
}

export default function AudioVisualizer({ audioRef, isPlaying, color = "#e50914" }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const ctxRef = useRef(null);
  const [mode, setMode] = useState("bars"); // bars | wave | circle

  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      // Reuse existing context if possible
      if (!ctxRef.current) {
        ctxRef.current = new AudioCtx();
      }
      const ctx = ctxRef.current;

      if (!analyserRef.current) {
        analyserRef.current = ctx.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.8;
      }

      if (!sourceRef.current) {
        try {
          sourceRef.current = ctx.createMediaElementSource(audio);
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(ctx.destination);
        } catch (e) {
          // Already connected (from equalizer) — skip
        }
      }

      if (ctx.state === "suspended") ctx.resume();
    } catch (e) {
      console.warn("Visualizer setup failed:", e.message);
    }

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [audioRef?.current]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx2d = canvas.getContext("2d");
    const bufLen = analyser.frequencyBinCount;
    const dataArr = new Uint8Array(bufLen);

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      const W = canvas.width, H = canvas.height;
      ctx2d.clearRect(0, 0, W, H);

      if (!isPlaying) {
        // Idle: draw flat line
        ctx2d.beginPath();
        ctx2d.strokeStyle = `${color}44`;
        ctx2d.lineWidth = 1.5;
        ctx2d.moveTo(0, H/2);
        ctx2d.lineTo(W, H/2);
        ctx2d.stroke();
        return;
      }

      if (mode === "bars") {
        analyser.getByteFrequencyData(dataArr);
        const barW = (W / bufLen) * 2.5;
        let x = 0;
        for (let i = 0; i < bufLen; i++) {
          const barH = (dataArr[i] / 255) * H;
          const alpha = 0.6 + (dataArr[i] / 255) * 0.4;
          ctx2d.fillStyle = `rgba(229,9,20,${alpha})`;
          ctx2d.beginPath();
          ctx2d.roundRect(x, H - barH, barW - 1, barH, 2);
          ctx2d.fill();
          x += barW + 1;
        }
      } else if (mode === "wave") {
        analyser.getByteTimeDomainData(dataArr);
        ctx2d.beginPath();
        ctx2d.strokeStyle = color;
        ctx2d.lineWidth = 2;
        ctx2d.shadowColor = color;
        ctx2d.shadowBlur = 8;
        const sliceW = W / bufLen;
        let x = 0;
        for (let i = 0; i < bufLen; i++) {
          const v = dataArr[i] / 128.0;
          const y = (v * H) / 2;
          i === 0 ? ctx2d.moveTo(x, y) : ctx2d.lineTo(x, y);
          x += sliceW;
        }
        ctx2d.lineTo(W, H / 2);
        ctx2d.stroke();
        ctx2d.shadowBlur = 0;
      } else if (mode === "circle") {
        analyser.getByteFrequencyData(dataArr);
        const cx = W / 2, cy = H / 2;
        const radius = Math.min(W, H) * 0.28;
        const bars = 64;
        const step = Math.floor(bufLen / bars);
        for (let i = 0; i < bars; i++) {
          const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
          const val = dataArr[i * step] / 255;
          const barLen = val * radius * 0.8;
          const x1 = cx + Math.cos(angle) * radius;
          const y1 = cy + Math.sin(angle) * radius;
          const x2 = cx + Math.cos(angle) * (radius + barLen);
          const y2 = cy + Math.sin(angle) * (radius + barLen);
          ctx2d.beginPath();
          ctx2d.strokeStyle = `rgba(229,9,20,${0.4 + val * 0.6})`;
          ctx2d.lineWidth = 2;
          ctx2d.moveTo(x1, y1);
          ctx2d.lineTo(x2, y2);
          ctx2d.stroke();
        }
        // Center dot
        ctx2d.beginPath();
        ctx2d.arc(cx, cy, radius * 0.15, 0, Math.PI * 2);
        ctx2d.fillStyle = "rgba(229,9,20,0.3)";
        ctx2d.fill();
      }
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, mode, color]);

  return (
    <div style={{ position:"relative", width:"100%", height:"60px" }}>
      <canvas
        ref={canvasRef}
        width={460}
        height={60}
        style={{ width:"100%", height:"60px", borderRadius:"8px" }}
      />
      {/* Mode switcher */}
      <div style={{ position:"absolute",top:"4px",right:"4px",display:"flex",gap:"3px" }}>
        {["bars","wave","circle"].map(m=>(
          <button key={m} onClick={()=>setMode(m)}
            style={{ background:mode===m?"rgba(229,9,20,0.3)":"rgba(0,0,0,0.5)",border:`1px solid ${mode===m?"rgba(229,9,20,0.5)":"rgba(255,255,255,0.08)"}`,color:mode===m?"#fff":"var(--text3)",borderRadius:"5px",padding:"2px 6px",fontSize:"9px",cursor:"pointer",textTransform:"capitalize" }}>
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}