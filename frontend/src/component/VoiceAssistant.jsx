import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "../store/useAppStore";

const COMMANDS = [
  { trigger: ["play", "resume"], desc: "Play / Resume" },
  { trigger: ["pause", "stop"], desc: "Pause" },
  { trigger: ["next"], desc: "Skip forward 10s" },
  { trigger: ["back", "rewind"], desc: "Skip back 10s" },
  { trigger: ["mute"], desc: "Toggle mute" },
  { trigger: ["fullscreen"], desc: "Fullscreen" },
  { trigger: ["home"], desc: "Go to Home" },
  { trigger: ["library"], desc: "Go to Library" },
  { trigger: ["history", "continue"], desc: "Continue Watching" },
  { trigger: ["search for", "find", "play "], desc: "Search for [title]" },
  { trigger: ["volume up"], desc: "Volume +20%" },
  { trigger: ["volume down"], desc: "Volume -20%" },
  { trigger: ["faster", "speed up"], desc: "Increase speed" },
  { trigger: ["slower", "slow down"], desc: "Decrease speed" },
  { trigger: ["close", "exit"], desc: "Close player" },
];

export default function VoiceAssistant() {
  const { setCurrentVideo, videos, setPage, voiceActive, setVoiceActive, setVolume, volume } = useAppStore();

  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState("idle"); // idle | listening | processing | error
  const [showHelp, setShowHelp] = useState(false);
  const [waveform, setWaveform] = useState([4, 4, 4, 4, 4]);
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef(null);
  const waveIntervalRef = useRef(null);
  const responseTimerRef = useRef(null);

  // Check browser support
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;        // Keep listening — don't stop after first result
    recognition.interimResults = true;    // Show partial results
    recognition.lang = "en-US";
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setStatus("listening");
      startWaveAnimation();
    };

    recognition.onresult = (e) => {
      let interim = "";
      let final = "";

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      setTranscript(final || interim);

      if (final.trim()) {
        setStatus("processing");
        handleCommand(final.toLowerCase().trim());
      }
    };

    recognition.onerror = (e) => {
      if (e.error === "no-speech") {
        // Just keep going — don't close
        setStatus("listening");
        return;
      }
      if (e.error === "not-allowed") {
        setResponse("❌ Microphone access denied. Please allow mic permission in your browser.");
        setStatus("error");
        setVoiceActive(false);
      } else {
        setStatus("listening"); // try to recover
      }
    };

    recognition.onend = () => {
      // Auto-restart if still active (handles browser cutting off)
      if (voiceActive && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (err) {
          // Already started
        }
      } else {
        setStatus("idle");
        stopWaveAnimation();
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch {}
    };
  }, []);

  // React to voiceActive changes
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (voiceActive) {
      setTranscript("");
      setResponse("");
      setStatus("listening");
      try { recognition.start(); } catch {}
      startWaveAnimation();
    } else {
      try { recognition.stop(); } catch {}
      stopWaveAnimation();
      setStatus("idle");
    }
  }, [voiceActive]);

  const startWaveAnimation = () => {
    clearInterval(waveIntervalRef.current);
    waveIntervalRef.current = setInterval(() => {
      setWaveform([
        Math.random() * 20 + 4,
        Math.random() * 28 + 6,
        Math.random() * 32 + 8,
        Math.random() * 28 + 6,
        Math.random() * 20 + 4,
      ]);
    }, 120);
  };

  const stopWaveAnimation = () => {
    clearInterval(waveIntervalRef.current);
    setWaveform([4, 4, 4, 4, 4]);
  };

  const speak = (text) => {
    setResponse(text);
    setStatus("listening");
    clearTimeout(responseTimerRef.current);
    responseTimerRef.current = setTimeout(() => setResponse(""), 4000);

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 1.05;
      utt.pitch = 1;
      utt.volume = 0.9;
      window.speechSynthesis.speak(utt);
    }
  };

  const handleCommand = useCallback((cmd) => {
    const v = document.querySelector("video");

    // ── Playback controls ──
    if (cmd.includes("pause") || cmd.includes("stop")) {
      v?.pause(); speak("Paused.");

    } else if (cmd.includes("play") && !cmd.includes("play ")) {
      v?.play(); speak("Playing.");

    } else if (cmd.includes("resume")) {
      v?.play(); speak("Resuming.");

    } else if (cmd.includes("next") || cmd.includes("forward")) {
      if (v) v.currentTime = Math.min(v.duration, v.currentTime + 10);
      speak("Skipped forward 10 seconds.");

    } else if (cmd.includes("back") || cmd.includes("rewind")) {
      if (v) v.currentTime = Math.max(0, v.currentTime - 10);
      speak("Rewound 10 seconds.");

    } else if (cmd.includes("mute")) {
      if (v) v.muted = !v.muted;
      speak(v?.muted ? "Muted." : "Unmuted.");

    } else if (cmd.includes("fullscreen")) {
      if (v) { if (!document.fullscreenElement) v.requestFullscreen(); else document.exitFullscreen(); }
      speak("Toggling fullscreen.");

    } else if (cmd.includes("volume up")) {
      const newVol = Math.min(1, volume + 0.2);
      setVolume(newVol);
      if (v) v.volume = newVol;
      speak(`Volume at ${Math.round(newVol * 100)} percent.`);

    } else if (cmd.includes("volume down")) {
      const newVol = Math.max(0, volume - 0.2);
      setVolume(newVol);
      if (v) v.volume = newVol;
      speak(`Volume at ${Math.round(newVol * 100)} percent.`);

    } else if (cmd.includes("faster") || cmd.includes("speed up")) {
      if (v) { v.playbackRate = Math.min(3, v.playbackRate + 0.5); speak(`Speed ${v.playbackRate}x.`); }

    } else if (cmd.includes("slower") || cmd.includes("slow down")) {
      if (v) { v.playbackRate = Math.max(0.25, v.playbackRate - 0.5); speak(`Speed ${v.playbackRate}x.`); }

    // ── Navigation ──
    } else if (cmd.includes("home")) {
      setPage("home"); speak("Going home.");

    } else if (cmd.includes("library")) {
      setPage("library"); speak("Opening library.");

    } else if (cmd.includes("history") || cmd.includes("continue")) {
      setPage("history"); speak("Opening continue watching.");

    } else if (cmd.includes("close") || cmd.includes("exit")) {
      speak("Closing player.");
      setTimeout(() => useAppStore.getState().setCurrentVideo(null), 800);

    // ── Search & play ──
    } else if (cmd.includes("search for ") || cmd.includes("find ") || cmd.startsWith("play ")) {
      const term = cmd
        .replace("search for ", "")
        .replace("find ", "")
        .replace(/^play /, "")
        .trim();

      const match = videos.find(v =>
        v.title.toLowerCase().includes(term) ||
        term.split(" ").some(word => v.title.toLowerCase().includes(word))
      );

      if (match) {
        setCurrentVideo(match);
        speak(`Playing ${match.title}.`);
      } else {
        speak(`Couldn't find anything matching "${term}". Try opening a folder first.`);
      }

    } else {
      speak("I didn't catch that. Say play, pause, next, back, home, library, volume up, or search for a title.");
    }
  }, [videos, volume, setPage, setCurrentVideo, setVolume]);

  const handleClose = () => {
    setVoiceActive(false);
    setTranscript("");
    setResponse("");
    setShowHelp(false);
  };

  // FAB button when closed
  if (!voiceActive) {
    return (
      <button
        onClick={() => {
          if (!supported) { alert("Voice recognition is not supported in this browser. Use Chrome or Edge."); return; }
          setVoiceActive(true);
        }}
        title="Voice Assistant — Jarvis Mode"
        style={{
          position: "fixed", bottom: "28px", right: "28px",
          width: "54px", height: "54px", borderRadius: "50%",
          background: "linear-gradient(135deg, #e50914, #c40812)",
          border: "none", color: "#fff", fontSize: "22px",
          cursor: "pointer", zIndex: 500,
          boxShadow: "0 4px 24px rgba(229,9,20,0.5)",
          transition: "transform 0.2s, box-shadow 0.2s",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.12)"; e.currentTarget.style.boxShadow = "0 6px 32px rgba(229,9,20,0.7)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(229,9,20,0.5)"; }}
      >
        🎙
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed", bottom: "28px", right: "28px",
      background: "rgba(10,10,10,0.97)",
      border: `1px solid ${status === "listening" ? "rgba(229,9,20,0.5)" : status === "error" ? "rgba(255,80,80,0.5)" : "rgba(255,255,255,0.1)"}`,
      borderRadius: "18px", padding: "18px 18px 14px",
      width: "290px", zIndex: 500,
      boxShadow: "0 20px 60px rgba(0,0,0,0.9)",
      backdropFilter: "blur(24px)",
      transition: "border-color 0.3s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
        {/* Animated mic / waveform */}
        <div style={{
          width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0,
          background: status === "listening" ? "rgba(229,9,20,0.15)" : "rgba(255,255,255,0.06)",
          border: `2px solid ${status === "listening" ? "rgba(229,9,20,0.6)" : "rgba(255,255,255,0.1)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.3s",
        }}>
          {status === "listening" ? (
            // Live waveform bars
            <div style={{ display: "flex", alignItems: "center", gap: "2px", height: "22px" }}>
              {waveform.map((h, i) => (
                <div key={i} style={{
                  width: "3px", height: `${h}px`, borderRadius: "2px",
                  background: "#e50914",
                  transition: "height 0.1s ease",
                }} />
              ))}
            </div>
          ) : (
            <span style={{ fontSize: "18px" }}>{status === "processing" ? "⚡" : status === "error" ? "⚠️" : "🎙"}</span>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>
            {status === "listening" ? "Listening..." : status === "processing" ? "Processing..." : status === "error" ? "Error" : "Jarvis"}
          </div>
          <div style={{ fontSize: "10px", color: "#555", letterSpacing: "0.06em" }}>VOICE ASSISTANT</div>
        </div>

        <div style={{ display: "flex", gap: "4px" }}>
          <button
            onClick={() => setShowHelp(h => !h)}
            style={{ background: showHelp ? "rgba(255,255,255,0.1)" : "none", border: "none", color: "#666", cursor: "pointer", fontSize: "14px", borderRadius: "6px", padding: "4px 6px" }}
            title="Show commands"
          >?</button>
          <button
            onClick={handleClose}
            style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "16px", lineHeight: 1, borderRadius: "6px", padding: "4px 6px" }}
          >✕</button>
        </div>
      </div>

      {/* Transcript */}
      {transcript && (
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "9px", padding: "9px 12px", marginBottom: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: "10px", color: "#555", marginBottom: "3px", letterSpacing: "0.06em" }}>YOU SAID</div>
          <div style={{ fontSize: "13px", color: "#ddd" }}>"{transcript}"</div>
        </div>
      )}

      {/* Response */}
      {response && (
        <div style={{ background: "rgba(229,9,20,0.08)", borderRadius: "9px", padding: "9px 12px", marginBottom: "8px", border: "1px solid rgba(229,9,20,0.2)" }}>
          <div style={{ fontSize: "10px", color: "#e50914", marginBottom: "3px", letterSpacing: "0.06em" }}>JARVIS</div>
          <div style={{ fontSize: "13px", color: "#fff" }}>{response}</div>
        </div>
      )}

      {/* Help panel */}
      {showHelp && (
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "9px", padding: "10px 12px", marginBottom: "8px", maxHeight: "180px", overflowY: "auto" }}>
          <div style={{ fontSize: "10px", color: "#555", marginBottom: "8px", letterSpacing: "0.06em" }}>AVAILABLE COMMANDS</div>
          {COMMANDS.map((c, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", fontSize: "11px" }}>
              <span style={{ color: "#e50914", fontFamily: "monospace" }}>"{c.trigger[0]}"</span>
              <span style={{ color: "#666" }}>{c.desc}</span>
            </div>
          ))}
        </div>
      )}

      {/* Status bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{
            width: "7px", height: "7px", borderRadius: "50%",
            background: status === "listening" ? "#e50914" : status === "processing" ? "#f5a623" : "#444",
            boxShadow: status === "listening" ? "0 0 8px rgba(229,9,20,0.8)" : "none",
            animation: status === "listening" ? "pulse 1.4s infinite" : "none",
          }} />
          <span style={{ fontSize: "10px", color: "#555" }}>
            {status === "listening" ? "Mic active — speak now" : status === "processing" ? "Processing..." : "Standby"}
          </span>
        </div>
        {/* Manual re-trigger */}
        {status !== "listening" && (
          <button
            onClick={() => { setStatus("listening"); try { recognitionRef.current?.start(); } catch {} }}
            style={{ background: "rgba(229,9,20,0.15)", border: "1px solid rgba(229,9,20,0.3)", color: "#e50914", fontSize: "10px", borderRadius: "6px", padding: "3px 8px", cursor: "pointer" }}
          >
            🎙 Retry
          </button>
        )}
      </div>
    </div>
  );
}