"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

// Dynamically import the Phaser component with SSR disabled
const GameComponent = dynamic(() => import("../components/GameComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-slate-400 text-sm animate-pulse">Loading Phaser Game Engine...</p>
      </div>
    </div>
  ),
});

interface Achievement {
  id: string;
  title: string;
  description: string;
  points: number;
}

interface GameConfig {
  theme_id: string;
  theme_name: string;
  background_color: string;
  player_sprite: string;
  player_color: string;
  player_speed: number;
  collectible_type: string;
  collectible_color: string;
  enemy_type: string;
  enemy_color: string;
  spawn_rate: number;
  win_score: number;
  mood: string;
  game_rules: string;
  achievements: Achievement[];
}

interface WSLog {
  timestamp: string;
  type: string;
  message: string;
  badge?: string;
}

export default function Home() {
  // Input and API states
  const [journalText, setJournalText] = useState(
    "Had an extremely productive day at the office. Handled code deployments, fixed several compilation bugs in our pipeline, and drank a lot of coffee to stay alert. Feeling proud!"
  );
  const [loading, setLoading] = useState(false);
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Game state
  const [currentScore, setCurrentScore] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  
  // WebSocket states
  const [wsActive, setWsActive] = useState(false);
  const [wsLogs, setWsLogs] = useState<WSLog[]>([]);
  const [wsInput, setWsInput] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll WebSocket logs
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [wsLogs]);

  // Connect to API and fetch config
  const handleGenerateGame = async () => {
    setLoading(true);
    setError(null);
    setGameWon(false);
    setCurrentScore(0);

    try {
      const response = await fetch("http://localhost:8000/api/generate-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: journalText }),
      });

      if (!response.ok) {
        throw new Error(`Failed to contact FastAPI server (Status ${response.status})`);
      }

      const data: GameConfig = await response.json();
      setGameConfig(data);
      
      // Auto-connect WS when a game is successfully generated
      if (!wsActive) {
        connectWebSocket();
      }
    } catch (err: any) {
      console.error(err);
      setError("Could not connect to the backend server. Please make sure the FastAPI server is running on http://localhost:8000.");
    } finally {
      setLoading(false);
    }
  };

  // Connect WebSocket
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
          let type = data.type || "info";
          let message = data.message || "";
          
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
    } catch (err) {
      addLog("error", "Failed to initialize WebSocket connection.");
    }
  };

  // Disconnect WebSocket
  const disconnectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }
  };

  // Send message over WebSocket
  const handleSendWSMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !wsInput.trim()) {
      return;
    }

    socketRef.current.send(wsInput);
    addLog("client", `Sent to server: "${wsInput}"`);
    setWsInput("");
  };

  const addLog = (type: string, message: string, badge?: string) => {
    const time = new Date().toLocaleTimeString();
    setWsLogs((prev) => [...prev, { timestamp: time, type, message, badge }]);
  };

  // Clean up sockets on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const handleScoreUpdate = (score: number) => {
    setCurrentScore(score);
  };

  const handleGameWin = () => {
    setGameWon(true);
    addLog("achievement", "Mission Complete: You completed the level!", "VICTORY");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Background radial gradient decoration */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(56,189,248,0.12),rgba(0,0,0,0))] pointer-events-none" />

      {/* Header section */}
      <header className="border-b border-slate-900 bg-slate-950/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <span className="text-xl font-bold text-white">P</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
                Play-Journal
              </h1>
              <p className="text-xs text-slate-400">Replay your day to unlock achievements</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              wsActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-900 text-slate-400 border border-slate-800"
            }`}>
              <span className={`w-2 h-2 rounded-full ${wsActive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
              WS Server: {wsActive ? "Connected" : "Offline"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
        
        {/* Left Column: Journal Entry and Controls */}
        <section className="lg:col-span-4 flex flex-col space-y-6">
          <div className="rounded-2xl border border-slate-900 bg-slate-900/40 backdrop-blur-sm p-6 shadow-xl flex flex-col space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              1. Document Your Day
            </h2>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Write about your achievements, emotions, or what you did today. The engine parses keywords to construct your personalized theme.
            </p>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 block font-medium">Journal Log</label>
              <textarea
                className="w-full h-44 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/60 transition-all resize-none leading-relaxed"
                value={journalText}
                onChange={(e) => setJournalText(e.target.value)}
                placeholder="How was your day? Write code? Throw a party? Walk in the rain?"
              />
            </div>

            <button
              onClick={handleGenerateGame}
              disabled={loading || !journalText.trim()}
              className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating Game...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  Generate Replay Game ✨
                </span>
              )}
            </button>

            {error && (
              <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-xl text-xs text-red-400 leading-relaxed">
                {error}
              </div>
            )}
          </div>


        </section>

        {/* Right Column: Phaser Game Canvas, JSON Config, WebSocket Logs */}
        <section className="lg:col-span-8 flex flex-col space-y-8">
          {gameConfig ? (
            <div className="flex flex-col space-y-6 animate-fade-in">
              
              {/* Active Game Section */}
              <div className="rounded-2xl border border-slate-900 bg-slate-900/20 p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Replay Arena</span>
                    <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                      {gameConfig.theme_name}
                      <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-md" 
                            style={{ backgroundColor: gameConfig.player_color + "15", color: gameConfig.player_color }}>
                        {gameConfig.mood}
                      </span>
                    </h2>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block uppercase">Level Progress</span>
                    <span className="text-xl font-mono font-bold text-white">
                      {currentScore} <span className="text-slate-600">/</span> {gameConfig.win_score}
                    </span>
                  </div>
                </div>

                {/* Rules description */}
                <div className="p-3 bg-slate-950 border border-slate-900 rounded-xl text-xs text-slate-400 leading-relaxed">
                  <span className="font-semibold text-slate-300 block mb-1">🎮 How to play:</span>
                  {gameConfig.game_rules}
                </div>

                {/* The Phaser Component */}
                <GameComponent
                  config={gameConfig}
                  onScoreUpdate={handleScoreUpdate}
                  onGameWin={handleGameWin}
                />

                {gameWon && (
                  <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-center space-y-2 animate-bounce">
                    <h3 className="text-base font-bold text-emerald-400">🎉 Level Completed! 🎉</h3>
                    <p className="text-xs text-emerald-300/80">
                      Great job completing this day's challenge! Re-submit your journal or edit it to play another theme.
                    </p>
                  </div>
                )}
              </div>

              {/* Grid for Achievements and JSON config */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Available Achievements list */}
                <div className="rounded-2xl border border-slate-900 bg-slate-900/30 p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    🏆 Achievements Ready
                  </h3>
                  
                  <div className="space-y-3">
                    {gameConfig.achievements.map((ach) => (
                      <div key={ach.id} className="p-3 bg-slate-950/80 border border-slate-900 rounded-xl flex items-center justify-between">
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-semibold text-slate-200">{ach.title}</h4>
                          <p className="text-[10px] text-slate-500">{ach.description}</p>
                        </div>
                        <span className="text-xs font-bold text-sky-400 font-mono">+{ach.points}xp</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* JSON config rendering panel */}
                <div className="rounded-2xl border border-slate-900 bg-slate-900/30 p-6 space-y-4 flex flex-col">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    ⚙️ Dynamic Engine JSON
                  </h3>
                  <div className="flex-1 min-h-[150px] bg-slate-950 rounded-xl border border-slate-900 p-3 font-mono text-[10px] text-slate-400 overflow-auto max-h-[220px]">
                    <pre>{JSON.stringify(gameConfig, null, 2)}</pre>
                  </div>
                </div>

              </div>

              {/* WebSockets Real-time streaming log */}
              <div className="rounded-2xl border border-slate-900 bg-slate-900/30 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      📡 WebSocket Event Stream (Connection Demo)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Simulates streaming live server events (achievements, score buffs, multiplayer updates) directly to Next.js.
                    </p>
                  </div>
                  <button
                    onClick={wsActive ? disconnectWebSocket : connectWebSocket}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition font-semibold ${
                      wsActive 
                        ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20" 
                        : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
                    }`}
                  >
                    {wsActive ? "Disconnect WS" : "Connect WS"}
                  </button>
                </div>

                {/* Console Log Area */}
                <div className="h-44 bg-slate-950 rounded-xl border border-slate-900 p-4 overflow-y-auto font-mono text-xs flex flex-col space-y-2">
                  {wsLogs.length === 0 ? (
                    <p className="text-slate-600 text-center my-auto">
                      No events received. Submit journal to connect or click Connect WS.
                    </p>
                  ) : (
                    wsLogs.map((log, index) => {
                      let textClass = "text-slate-400";
                      let badgeClass = "bg-slate-800 text-slate-400";

                      if (log.type === "system") {
                        textClass = "text-indigo-400 font-bold";
                      } else if (log.type === "error") {
                        textClass = "text-red-400";
                      } else if (log.type === "achievement") {
                        textClass = "text-yellow-400";
                        badgeClass = "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20";
                      } else if (log.type === "reward") {
                        textClass = "text-emerald-400";
                        badgeClass = "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20";
                      } else if (log.type === "client") {
                        textClass = "text-sky-300";
                      }

                      return (
                        <div key={index} className="flex items-start gap-2 border-b border-slate-950 pb-1.5">
                          <span className="text-[10px] text-slate-600">{log.timestamp}</span>
                          {log.badge && (
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold tracking-wider ${badgeClass}`}>
                              {log.badge}
                            </span>
                          )}
                          <span className={textClass}>{log.message}</span>
                        </div>
                      );
                    })
                  )}
                  <div ref={logEndRef} />
                </div>

                {/* WebSocket input form */}
                {wsActive && (
                  <form onSubmit={handleSendWSMessage} className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-slate-950 border border-slate-900 rounded-xl px-4 py-2 text-xs text-slate-300 placeholder-slate-700 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                      placeholder="Send custom feedback event to WebSocket backend..."
                      value={wsInput}
                      onChange={(e) => setWsInput(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs px-4 py-2 rounded-xl transition font-semibold"
                    >
                      Send Event
                    </button>
                  </form>
                )}
              </div>

            </div>
          ) : (
            <div className="h-full min-h-[450px] flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 bg-slate-900/10 rounded-2xl">
              <div className="w-16 h-16 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-center text-3xl mb-4">
                🕹️
              </div>
              <h3 className="text-lg font-bold text-slate-300 mb-1">Waiting for daily log</h3>
              <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
                Submit a journal entry on the left panel to initialize your dynamic arcade canvas and connect to the event stream.
              </p>
              <button
                onClick={handleGenerateGame}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-semibold text-xs transition"
              >
                Generate Game Log
              </button>
            </div>
          )}
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-600 mt-auto">
        <p>© 2026 Play-Journal Engine Draft. Built with Next.js, Phaser, FastAPI, and Tailwind CSS v4.</p>
      </footer>
    </div>
  );
}
