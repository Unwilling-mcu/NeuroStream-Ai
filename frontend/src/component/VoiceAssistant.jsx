import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "../store/useAppStore";

const COMMANDS = [
  { cmd: "play",        desc: "Resume playback" },
  { cmd: "pause",       desc: "Pause playback" },
  { cmd: "next",        desc: "Skip to end / next" },
  { cmd: "mute",        desc: "Toggle mute" },
  { cmd: "fullscreen",  desc: "Toggle fullscreen" },
  { cmd: "home",        desc: "Go to Home" },
  { cmd: "library",     desc: "Go to Library" },
  { cmd: "history",     desc: "Go to Continue Watching" },
  { cmd: "open folder", desc: "Open folder picker" },
  { cmd: "search [title]", desc: "Search & play a video" },
];

export default function VoiceAssistant() {
  const { setCurrentVideo, videos, setPage, voiceActive, setVoiceActive, openFolder, setMuted } = useAppStore();

  const [status, setStatus]         = useState("idle"); // idle | listening | processing | error
  const [transcript, setTranscript] = useState("");
  const [response, setResponse]     = useState("");
  const [showHelp, setShowHelp]     = useState(false);
  const [supported, setSupported]   = useState(true);
  const [bars, setBars]             = useState([3,5,4,6,3,7,4,5,3,6]); // waveform heights
  const [showPanel, setShowPanel]   = useState(false);

  const recognitionRef  = useRef(null);
  const waveTimerRef    = useRef(null);
  const autoCloseRef    = useRef(null);

  // Animate waveform bars when listening
  const animateBars = useCallback(() => {
    if (waveTimerRef.current) clearInterval(waveTimerRef.current);
    waveTimerRef.current = setInterval(() => {
      setBars(prev => prev.map(() => Math.floor(Math.random() * 18) + 3));
    }, 120);
  }, []);

  const stopBars = useCallback(() => {
    clearInterval(waveTimerRef.current);
    setBars([3,5,4,6,3,7,4,5,3,6]);
  }, []);

  // Speak response aloud
  const speak = useCallback((text) => {
    window.speechSynthesis?.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.05;
    utt.pitch = 1;
    // Pick a good voice if available
    const voices = window.speechSynthesis?.getVoices() || [];
    const preferred = voices.find(v => v.name.includes("Google") || v.name.includes("Natural") || v.lang === "en-US");
    if (preferred) utt.voice = preferred;
    window.speechSynthesis?.speak(utt);
    setResponse(text);
  }, []);

  // Process voice command
  const handleCommand = useCallback((cmd) => {
    setStatus("processing");
    const c = cmd.toLowerCase().trim();

    if (c.includes("pause") || c.includes("stop")) {
      document.querySelector("video")?.pause();
      speak("Paused.");

    } else if (c.includes("play") || c.includes("resume")) {
      // Check if it's "play [title]"
      const match = c.match(/play (.+)/);
      if (match) {
        const term = match[1].trim();
        const found = videos.find(v => v.title.toLowerCase().includes(term));
        if (found) { setCurrentVideo(found); speak(`Playing ${found.title}.`); }
        else { document.querySelector("video")?.play(); speak(`Couldn't find "${term}". Resuming current video.`); }
      } else {
        document.querySelector("video")?.play();
        speak("Playing.");
      }

    } else if (c.includes("mute")) {
      const v = document.querySelector("video");
      if (v) { v.muted = !v.muted; setMuted(v.muted); speak(v.muted ? "Muted." : "Unmuted."); }

    } else if (c.includes("volume up")) {
      const v = document.querySelector("video");
      if (v) { v.volume = Math.min(1, v.volume + 0.2); speak("Volume up."); }

    } else if (c.includes("volume down")) {
      const v = document.querySelector("video");
      if (v) { v.volume = Math.max(0, v.volume - 0.2); speak("Volume down."); }

    } else if (c.includes("next") || c.includes("skip")) {
      const v = document.querySelector("video");
      if (v) { v.currentTime = v.duration; speak("Skipping."); }

    } else if (c.includes("fullscreen")) {
      const v = document.querySelector("video");
      if (v) { document.fullscreenElement ? document.exitFullscreen() : v.requestFullscreen(); speak("Toggling fullscreen."); }

    } else if (c.includes("rewind") || c.includes("go back")) {
      const v = document.querySelector("video");
      if (v) { v.currentTime = Math.max(0, v.currentTime - 30); speak("Rewound 30 seconds."); }

    } else if (c.includes("forward") || c.includes("fast forward")) {
      const v = document.querySelector("video");
      if (v) { v.currentTime = Math.min(v.duration, v.currentTime + 30); speak("Forwarded 30 seconds."); }

    } else if (c.includes("home")) {
      setPage("home"); speak("Going home.");

    } else if (c.includes("library")) {
      setPage("library"); speak("Opening library.");

    } else if (c.includes("history") || c.includes("continue")) {
      setPage("history"); speak("Opening watch history.");

    } else if (c.includes("open folder") || c.includes("select folder")) {
      openFolder(); speak("Opening folder picker.");

    } else if (c.includes("search for ") || c.includes("find ")) {
      const term = c.replace("search for ", "").replace("find ", "").trim();
      const found = videos.find(v => v.title.toLowerCase().includes(term));
      if (found) { setCurrentVideo(found); speak(`Playing ${found.title}.`); }
      else { speak(`Couldn't find "${term}" in your library.`); }

    } else if (c.includes("help") || c.includes("what can you do")) {
      setShowHelp(true);
      speak("Here are my available commands.");

    } else {
      speak(`I didn't catch that. Say "help" to see what I can do.`);
    }

    setTimeout(() => setStatus("idle"), 1500);
  }, [videos, setCurrentVideo, setPage, openFolder, setMuted, speak]);

  // Setup recognition
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }

    const r = new SR();
    r.continuous = false;
    r.interimResults = true;
    r.lang = "en-US";
    r.maxAlternatives = 3;

    r.onstart = () => {
      setStatus("listening");
      setTranscript("");
      setResponse("");
      animateBars();
    };

    r.onresult = (e) => {
      const results = Array.from(e.results);
      const interim = results.map(r => r[0].transcript).join("");
      setTranscript(interim);

      const finalResult = results.find(r => r.isFinal);
      if (finalResult) {
        const text = finalResult[0].transcript;
        setTranscript(text);
        stopBars();
        handleCommand(text);
      }
    };

    r.onerror = (e) => {
      stopBars();
      if (e.error === "no-speech") {
        setStatus("idle");
        setResponse("No speech detected. Try again.");
      } else if (e.error === "not-allowed") {
        setStatus("error");
        setResponse("Microphone access denied. Please allow mic in browser settings.");
        setSupported(false);
      } else {
        setStatus("error");
        setResponse(`Error: ${e.error}`);
      }
    };

    r.onend = () => {
      stopBars();
      if (status === "listening") setStatus("idle");
    };

    recognitionRef.current = r;

    return () => {
      r.abort();
      clearInterval(waveTimerRef.current);
      clearTimeout(autoCloseRef.current);
    };
  }, [handleCommand, animateBars, stopBars]);

  const startListening = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.abort();
      setTimeout(() => {
        try { recognitionRef.current.start(); } catch {}
      }, 100);
    } catch {}
  };

  const stopListening = () => {
    try { recognitionRef.current?.abort(); } catch {}
    stopBars();
    setStatus("idle");
    setVoiceActive(false);
  };

  // Open panel + start listening
  const handleOpen = () => {
    setShowPanel(true);
    setVoiceActive(true);
    setTranscript("");
    setResponse("");
    setShowHelp(false);
    setTimeout(startListening, 200);
  };

  const handleClose = () => {
    stopListening();
    setShowPanel(false);
    setShowHelp(false);
  };

  const handleMicClick = () => {
    if (status === "listening") {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!supported) return (
    <div style={{
      position: "fixed", bottom: "24px", right: "24px",
      background: "rgba(20,20,20,0.9)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "12px", padding: "12px 16px",
      fontSize: "12px", color: "#666", zIndex: 500,
    }}>
      🎙 Voice not supported in this browser
    </div>
  );

  return (
    <>
      {/* FAB button */}
      {!showPanel && (
        <button
          onClick={handleOpen}
          title="Voice Assistant"
          style={{
            position: "fixed", bottom: "24px", right: "24px",
            width: "54px", height: "54px", borderRadius: "50%",
            background: "linear-gradient(135deg, #e50914, #ff6b35)",
            border: "none", color: "#fff", fontSize: "22px",
            cursor: "pointer", zIndex: 500,
            boxShadow: "0 4px 24px rgba(229,9,20,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 6px 32px rgba(229,9,20,0.7)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(229,9,20,0.5)"; }}
        >
          🎙
        </button>
      )}

      {/* Main panel */}
      {showPanel && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px",
          width: "300px",
          background: "rgba(10,10,10,0.97)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "20px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.9)",
          backdropFilter: "blur(24px)",
          zIndex: 500,
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "16px 18px 12px",
            background: "linear-gradient(135deg, rgba(229,9,20,0.15), rgba(255,107,53,0.08))",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", gap: "12px",
          }}>
            <div style={{
              width: "38px", height: "38px", borderRadius: "50%",
              background: status === "listening" ? "rgba(229,9,20,0.3)" : "rgba(255,255,255,0.06)",
              border: `2px solid ${status === "listening" ? "#e50914" : "rgba(255,255,255,0.1)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "18px",
              animation: status === "listening" ? "pulse 1.2s ease-in-out infinite" : "none",
              transition: "all 0.3s",
              flexShrink: 0,
            }}>🎙</div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>Jarvis</div>
              <div style={{ fontSize: "11px", color: status === "listening" ? "#e50914" : status === "error" ? "#f5a623" : "#555" }}>
                {status === "listening" ? "● Listening..." : status === "processing" ? "⚡ Processing..." : status === "error" ? "⚠ Error" : "○ Ready"}
              </div>
            </div>

            <button onClick={handleClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "18px", lineHeight: 1 }}>✕</button>
          </div>

          {/* Waveform */}
          <div style={{
            padding: "16px 18px",
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: "3px", height: "52px",
          }}>
            {status === "listening" ? (
              bars.map((h, i) => (
                <div key={i} style={{
                  width: "3px", height: `${h}px`,
                  background: `hsl(${350 + i * 3}, 80%, ${50 + i * 2}%)`,
                  borderRadius: "2px",
                  transition: "height 0.1s ease",
                }} />
              ))
            ) : (
              <div style={{ fontSize: "12px", color: "#444", textAlign: "center" }}>
                {status === "processing" ? "Understanding command..." : "Click mic to speak"}
              </div>
            )}
          </div>

          {/* Transcript */}
          {transcript && (
            <div style={{ margin: "0 16px 10px", background: "rgba(255,255,255,0.04)", borderRadius: "10px", padding: "10px 12px" }}>
              <div style={{ fontSize: "10px", color: "#555", marginBottom: "4px", letterSpacing: "0.06em" }}>YOU SAID</div>
              <div style={{ fontSize: "13px", color: "#ddd" }}>"{transcript}"</div>
            </div>
          )}

          {/* Response */}
          {response && (
            <div style={{ margin: "0 16px 10px", background: "rgba(229,9,20,0.08)", border: "1px solid rgba(229,9,20,0.2)", borderRadius: "10px", padding: "10px 12px" }}>
              <div style={{ fontSize: "10px", color: "#e50914", marginBottom: "4px", letterSpacing: "0.06em" }}>JARVIS</div>
              <div style={{ fontSize: "13px", color: "#fff" }}>{response}</div>
            </div>
          )}

          {/* Help list */}
          {showHelp && (
            <div style={{ margin: "0 16px 10px", maxHeight: "180px", overflowY: "auto" }}>
              {COMMANDS.map((c, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: "12px" }}>
                  <span style={{ color: "#e50914", fontFamily: "monospace" }}>"{c.cmd}"</span>
                  <span style={{ color: "#666" }}>{c.desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* Bottom controls */}
          <div style={{ padding: "12px 16px 16px", display: "flex", gap: "8px", alignItems: "center" }}>
            {/* Mic button */}
            <button
              onClick={handleMicClick}
              style={{
                flex: 1, padding: "11px",
                background: status === "listening"
                  ? "linear-gradient(135deg, #e50914, #c40812)"
                  : "rgba(255,255,255,0.06)",
                border: status === "listening" ? "none" : "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px", color: "#fff",
                fontSize: "13px", fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                transition: "all 0.2s",
                boxShadow: status === "listening" ? "0 4px 20px rgba(229,9,20,0.4)" : "none",
              }}
            >
              {status === "listening" ? "⏹ Stop" : "🎙 Speak"}
            </button>

            {/* Help button */}
            <button
              onClick={() => setShowHelp(v => !v)}
              style={{
                padding: "11px 14px",
                background: showHelp ? "rgba(229,9,20,0.15)" : "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px", color: showHelp ? "#e50914" : "#666",
                fontSize: "13px", cursor: "pointer", fontWeight: 600,
                transition: "all 0.15s",
              }}
              title="Show commands"
            >
              ?
            </button>
          </div>
        </div>
      )}
    </>
  );
}