// WatchTogetherManager.jsx
// Mounts ONCE in App.jsx root — manages the WebSocket so it survives page navigation.
// WatchTogether UI reads from store; this manager writes to store.
import { useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";

export const wtWsRef = { current: null }; // shared ref so WatchTogether UI can send messages

export default function WatchTogetherManager() {
  const {
    videos,
    wtJoined, wtRoomId, wtIsHost,
    setWtJoined, setWtPeers, setWtRoomId, setWtRoomVideo,
    setWtStatus, addWtLog, resetWt,
  } = useAppStore();

  const videoElRef  = useRef(null);
  const ignoreRef   = useRef(false);
  const pingRef     = useRef(null);

  // Keep a ref to videos so WebSocket callbacks can read current value
  const videosRef = useRef(videos);
  useEffect(() => { videosRef.current = videos; }, [videos]);

  // Expose connect / disconnect globally so WatchTogether UI can trigger them
  useEffect(() => {
    window.__wtConnect = (roomId, asHost) => {
      if (wtWsRef.current) { wtWsRef.current.close(); wtWsRef.current = null; }
      setWtStatus("connecting");

      const ws = new WebSocket("ws://localhost:5000");
      wtWsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", roomId }));
        pingRef.current = setInterval(() => {
          if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ping" }));
        }, 25000);
      };

      ws.onmessage = (e) => {
        let msg; try { msg = JSON.parse(e.data); } catch { return; }
        const v = document.getElementById("wt-video");

        if (msg.type === "joined") {
          setWtJoined(true); setWtStatus("connected"); setWtRoomId(roomId);
          addWtLog(asHost ? "🎬 Room created — you are the host" : "✅ Joined room");
        }
        if (msg.type === "peers") setWtPeers(msg.count);

        if (msg.type === "state-request") {
          const cur = useAppStore.getState();
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: "state", roomId,
              time: v?.currentTime || 0,
              paused: v?.paused ?? true,
              videoPath: cur.wtRoomVideo?.file_path || null,
              videoTitle: cur.wtRoomVideo?.title || null,
            }));
          }
        }

        if (msg.type === "state" || msg.type === "video") {
          if (msg.videoPath) {
            const match = videosRef.current.find(vv => vv.file_path === msg.videoPath);
            if (match) {
              setWtRoomVideo(match);
              addWtLog("📡 " + (msg.type === "video" ? "Host changed: " : "Synced: ") + match.title);
              if (msg.type === "state" && v) {
                setTimeout(() => {
                  ignoreRef.current = true;
                  if (Math.abs(v.currentTime - (msg.time||0)) > 1) v.currentTime = msg.time || 0;
                  if (!msg.paused) v.play(); else v.pause();
                  setTimeout(() => { ignoreRef.current = false; }, 400);
                }, 600);
              }
            }
          } else if (v && msg.type === "state") {
            ignoreRef.current = true;
            if (Math.abs(v.currentTime - (msg.time||0)) > 1) v.currentTime = msg.time || 0;
            msg.paused ? v.pause() : v.play();
            setTimeout(() => { ignoreRef.current = false; }, 300);
          }
        }

        if (msg.type === "play"  && !ignoreRef.current) {
          const vv = document.getElementById("wt-video");
          if (vv) { ignoreRef.current = true; vv.play(); addWtLog("▶ Play"); setTimeout(() => { ignoreRef.current = false; }, 300); }
        }
        if (msg.type === "pause" && !ignoreRef.current) {
          const vv = document.getElementById("wt-video");
          if (vv) { ignoreRef.current = true; vv.pause(); addWtLog("⏸ Pause"); setTimeout(() => { ignoreRef.current = false; }, 300); }
        }
        if (msg.type === "seek"  && !ignoreRef.current) {
          const vv = document.getElementById("wt-video");
          if (vv && Math.abs(vv.currentTime - msg.time) > 0.5) {
            ignoreRef.current = true;
            vv.currentTime = msg.time;
            addWtLog("⏩ Seek → " + Math.floor(msg.time) + "s");
            setTimeout(() => { ignoreRef.current = false; }, 300);
          }
        }
      };

      ws.onclose = () => {
        clearInterval(pingRef.current);
        resetWt();
        wtWsRef.current = null;
      };
      ws.onerror = () => { setWtStatus("error"); };
    };

    window.__wtDisconnect = () => {
      clearInterval(pingRef.current);
      wtWsRef.current?.close();
      wtWsRef.current = null;
      resetWt();
    };

    window.__wtSend = (msg) => {
      if (wtWsRef.current?.readyState === 1) {
        wtWsRef.current.send(JSON.stringify(msg));
      }
    };

    return () => {
      delete window.__wtConnect;
      delete window.__wtDisconnect;
      delete window.__wtSend;
    };
  }, []);

  // Attach play/pause/seek listeners to wt-video whenever it exists
  useEffect(() => {
    if (!wtJoined) return;
    const roomId = useAppStore.getState().wtRoomId;
    const attach = () => {
      const v = document.getElementById("wt-video");
      if (!v) return;
      const send = (type, extra={}) => {
        if (ignoreRef.current) return;
        window.__wtSend?.({ type, roomId, ...extra });
      };
      const onPlay  = () => send("play");
      const onPause = () => send("pause");
      const onSeek  = () => send("seek", { time: v.currentTime });
      v.addEventListener("play",   onPlay);
      v.addEventListener("pause",  onPause);
      v.addEventListener("seeked", onSeek);
      return () => {
        v.removeEventListener("play",   onPlay);
        v.removeEventListener("pause",  onPause);
        v.removeEventListener("seeked", onSeek);
      };
    };
    // wt-video may not exist yet — poll briefly
    let cleanup;
    const timer = setInterval(() => {
      cleanup = attach();
      if (cleanup) clearInterval(timer);
    }, 300);
    return () => { clearInterval(timer); cleanup?.(); };
  }, [wtJoined]);

  return null; // no UI — just logic
}