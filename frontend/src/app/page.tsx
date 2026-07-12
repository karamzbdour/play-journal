"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
  const [isOpen, setIsOpen] = useState(false);

  // Input and API states
  const [journalText, setJournalText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallingAsleep, setFallingAsleep] = useState(false);

  // Fade the scene to black — drifting off to sleep — then wake up in the dungeon.
  // Duration matches the fall-asleep animation in globals.css plus a small hold.
  const SLEEP_FADE_MS = 2200;
  const fallAsleepThenPlay = () => {
    setFallingAsleep(true);
    window.setTimeout(() => router.push("/play"), SLEEP_FADE_MS);
  };

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

  useEffect(() => {
    const handleClose = () => {
      setIsOpen(false);
    };
    window.addEventListener("close-book", handleClose);
    return () => window.removeEventListener("close-book", handleClose);
  }, []);

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
      fallAsleepThenPlay();
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
    fallAsleepThenPlay();
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
    <>

    <div className="tome-scene flex flex-col items-center justify-center px-3 pt-20">
      <div className="tome-embers" aria-hidden />

      {memories !== null && (
        <Book 
          spreads={spreads} 
          index={spreadIndex} 
          onIndexChange={setSpreadIndex} 
          isOpen={isOpen}
          onOpenChange={setIsOpen}
        />
      )}
    </div>

    {/* Sibling of .tome-scene: the fixed scene creates its own stacking
        context, so the overlay must live outside it to cover the nav bar. */}
    {fallingAsleep && <div className="sleep-fade" aria-hidden />}
    </>
  );
}
