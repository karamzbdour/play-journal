"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { GameConfig } from "@/types/game";
import { mockGameConfig } from "@/lib/mockGameConfig";
import { saveGameConfig } from "@/lib/gameSession";

export default function Home() {
  const router = useRouter();

  // Input and API states
  const [journalText, setJournalText] = useState(
    "Had an extremely productive day at the office. Handled code deployments, fixed several compilation bugs in our pipeline, and drank a lot of coffee to stay alert. Feeling proud!"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Connect to API, fetch config, then hand off to the /play page
  const handleGenerateGame = async () => {
    setLoading(true);
    setError(null);

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
      saveGameConfig(data);
      router.push("/play");
    } catch (err: any) {
      console.error(err);
      setError("Could not connect to the backend server. Please make sure the FastAPI server is running on http://localhost:8000.");
    } finally {
      setLoading(false);
    }
  };

  // Loads a local fixture matching the current GameConfig schema, bypassing the backend.
  // Useful while the LLM-driven /api/generate-game endpoint hasn't caught up to the schema yet.
  const handlePreviewMock = () => {
    setError(null);
    saveGameConfig(mockGameConfig);
    router.push("/play");
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

            <button
              onClick={handlePreviewMock}
              className="w-full rounded-xl border border-dashed border-slate-800 py-2 text-xs font-medium text-slate-500 hover:text-slate-300 hover:border-slate-700 transition"
            >
              Preview with mock data (skips backend) 🧪
            </button>
          </div>


        </section>

        {/* Right Column: Placeholder / explanation until a game is generated */}
        <section className="lg:col-span-8 flex flex-col space-y-8">
          <div className="h-full min-h-[450px] flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 bg-slate-900/10 rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-center text-3xl mb-4">
              🕹️
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
