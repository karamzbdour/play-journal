"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { GameConfig } from "@/types/game";
import { loadGameConfig, clearGameConfig } from "@/lib/gameSession";

// Dynamically import the Phaser component with SSR disabled
const GameComponent = dynamic(() => import("../../components/GameComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-slate-400 text-sm animate-pulse">Loading Phaser Game Engine...</p>
      </div>
    </div>
  ),
});

interface WSLog {
  timestamp: string;
  type: string;
  message: string;
  badge?: string;
}

export default function PlayPage() {
  const router = useRouter();
  const [gameConfig, setGameConfigState] = useState<GameConfig | null>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);

  // Game state
  const [currentScore, setCurrentScore] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(1);

  // WebSocket state (no UI right now, kept so the backend event feed still connects)
  const [wsActive, setWsActive] = useState(false);
  const [wsLogs, setWsLogs] = useState<WSLog[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  // Load the config handed off from the journal page; bounce back if there isn't one
  useEffect(() => {
    const config = loadGameConfig();
    setGameConfigState(config);
    setCheckedStorage(true);
    if (!config) {
      router.replace("/");
    }
  }, [router]);

  const addLog = (type: string, message: string, badge?: string) => {
    const time = new Date().toLocaleTimeString();
    setWsLogs((prev) => [...prev, { timestamp: time, type, message, badge }]);
  };

  const connectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    try {
      const socket = new WebSocket("ws://localhost:8000/ws/live-feed");
      socketRef.current = socket;
      setWsActive(true);

      socket.onopen = () => {
        addLog("system", "WebSocket connected to backend.");
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const type = data.type || "info";
          const message = data.message || "";

          if (type === "achievement") {
            addLog("achievement", message, "ACHIEVEMENT");
          } else if (type === "reward") {
            addLog("reward", message, "POWER-UP");
          } else {
            addLog("info", message);
          }
        } catch {
          addLog("info", event.data);
        }
      };

      socket.onclose = () => {
        setWsActive(false);
        addLog("system", "WebSocket disconnected.");
      };

      socket.onerror = () => {
        addLog("error", "WebSocket error occurred.");
      };
    } catch {
      addLog("error", "Failed to initialize WebSocket connection.");
    }
  };

  // Connect WS once the config is ready, clean up socket on unmount
  useEffect(() => {
    if (gameConfig && !socketRef.current) {
      connectWebSocket();
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameConfig]);

  const handleScoreUpdate = (score: number) => {
    setCurrentScore(score);
  };

  const handleGameWin = () => {
    setGameWon(true);
    addLog("achievement", "Mission Complete: You completed the level!", "VICTORY");
  };

  const handleLevelUpdate = (level: number, totalLevels: number) => {
    setCurrentLevel(level);
    if (level > 1) {
      addLog("info", `Level ${level} / ${totalLevels} reached!`);
    }
  };

  const handleBackToJournal = () => {
    clearGameConfig();
    router.push("/");
  };

  if (!checkedStorage) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
        Loading your run...
      </div>
    );
  }

  if (!gameConfig) {
    // useEffect above is already redirecting to "/"
    return null;
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 relative">
      <button
        onClick={handleBackToJournal}
        className="absolute top-3 left-3 z-10 text-xs px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 backdrop-blur-md transition font-semibold"
      >
        ← Back
      </button>

      <div className="w-full h-full">
        <GameComponent
          config={gameConfig}
          onScoreUpdate={handleScoreUpdate}
          onGameWin={handleGameWin}
          onLevelUpdate={handleLevelUpdate}
        />
      </div>
    </div>
  );
}
