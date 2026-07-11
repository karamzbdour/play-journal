"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GameConfig } from "@/types/game";
import { mockGameConfig } from "@/lib/mockGameConfig";
import { saveGameConfig } from "@/lib/gameSession";
import { MemoryEntry, loadMemories, saveMemory } from "@/lib/journal";
import Book, { Spread } from "@/components/book/Book";
import memorySpread from "@/components/book/MemorySpread";
import todaySpread from "@/components/book/TodaySpread";
import { isAuthenticated, getAuthHeaders } from "@/lib/auth";


export default function Home() {
  const router = useRouter();

  // The tome's filled pages; null until localStorage has been read (client only)
  const [memories, setMemories] = useState<MemoryEntry[] | null>(null);
  const [spreadIndex, setSpreadIndex] = useState(0);

  // Input and API states
  const [journalText, setJournalText] = useState(
    "Had an extremely productive day at the office. Handled code deployments, fixed several compilation bugs in our pipeline, and drank a lot of coffee to stay alert. Feeling proud!"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Open the book on today's blank page (the spread after the last memory)
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    const stored = loadMemories();
    setMemories(stored);
    setSpreadIndex(stored.length);
  }, [router]);

  // Connect to API, fetch config, ink the page into the tome, then play it
  const handleGenerateGame = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:8000/api/generate-game", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ text: journalText }),
      });

      if (!response.ok) {
        throw new Error(`Failed to contact FastAPI server (Status ${response.status})`);
      }

      const data: GameConfig = await response.json();
      saveMemory(journalText, data);
      saveGameConfig(data);
      router.push("/play");
    } catch (err) {
      console.error(err);
      setError(
        "The dungeon didn't answer. Start the backend at http://localhost:8000 and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Loads a local fixture matching the current GameConfig schema, bypassing the
  // backend. Doesn't ink a page - it's a test rig, not a memory.
  const handlePreviewMock = () => {
    setError(null);
    saveGameConfig(mockGameConfig);
    router.push("/play");
  };

  const handleRelive = (entry: MemoryEntry) => {
    saveGameConfig(entry.config);
    router.push("/play");
  };

  const spreads: Spread[] = useMemo(() => {
    if (memories === null) return [];
    const filled = memories.map((entry, i) => memorySpread(entry, i, handleRelive));
    return [
      ...filled,
      todaySpread({
        spreadIndex: memories.length,
        journalText,
        onJournalTextChange: setJournalText,
        loading,
        error,
        onGenerate: handleGenerateGame,
        onPreviewMock: handlePreviewMock,
      }),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memories, journalText, loading, error]);

  return (
    <div className="tome-scene flex flex-col items-center justify-center gap-5 px-3">
      <header className="text-center relative z-10">
        <h1
          className="tome-heading"
          style={{ color: "var(--torch)", textShadow: "0 0 24px rgba(251,191,36,0.35)" }}
        >
          Play-Journal
        </h1>
        <p className="tome-eyebrow" style={{ color: "#8a7550", marginTop: "0.35rem" }}>
          The tome of days
        </p>
      </header>

      {memories !== null && (
        <Book spreads={spreads} index={spreadIndex} onIndexChange={setSpreadIndex} />
      )}

      <p className="tome-eyebrow relative z-10" style={{ color: "#57503f" }}>
        ◄ ► turn the page
      </p>
    </div>
  );
}
