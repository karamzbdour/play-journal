"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { GameConfig } from "@/types/game";
import { loadGameConfig, clearGameConfig } from "@/lib/gameSession";
import GameSettingsMenu from "@/components/GameSettingsMenu";

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

export default function PlayPage() {
  const router = useRouter();
  const [gameConfig, setGameConfigState] = useState<GameConfig | null>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
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

  // Keep the backend event feed connected while playing. There's no feed UI
  // yet, so messages just go to the console.
  useEffect(() => {
    if (!gameConfig || socketRef.current) return;
    try {
      const socket = new WebSocket("ws://localhost:8000/ws/live-feed");
      socketRef.current = socket;
      socket.onmessage = (event) => console.debug("[live-feed]", event.data);
      socket.onerror = () => console.debug("[live-feed] connection error");
    } catch {
      console.debug("[live-feed] failed to initialize WebSocket");
    }
    return () => {
      socketRef.current?.close();
    };
  }, [gameConfig]);

  const handleBackToJournal = () => {
    clearGameConfig();
    router.push("/");
  };

  const handleGameOver = () => {
    setIsGameOver(true);
  };

  const handleRestart = () => {
    clearGameConfig();
    setIsGameOver(false);
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

      <GameSettingsMenu />

      <div className="w-full h-full">
        <GameComponent config={gameConfig} onGameOver={handleGameOver} />
      </div>

      {isGameOver && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900/90 p-8 text-center shadow-2xl">
            <p className="text-4xl font-black tracking-[0.2em] text-red-400">GAME OVER</p>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              The dungeon claimed your run. Return to the main page and begin another tale.
            </p>
            <button
              onClick={handleRestart}
              className="mt-6 w-full rounded-2xl border border-amber-500/40 bg-amber-500/90 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
            >
              Return to Main Page
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
