"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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

  // Auth state for the landing experience
  const [authState, setAuthState] = useState<"unknown" | "guest" | "authenticated">("unknown");

  // The tome's filled pages; null until localStorage has been read (client only)
  const [memories, setMemories] = useState<MemoryEntry[] | null>(null);
  const [spreadIndex, setSpreadIndex] = useState(0);

  // Input and API states
  const [journalText, setJournalText] = useState(
    "Had an extremely productive day at the office. Handled code deployments, fixed several compilation bugs in our pipeline, and drank a lot of coffee to stay alert. Feeling proud!"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallingAsleep, setFallingAsleep] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fade the scene to black — drifting off to sleep — then wake up in the dungeon.
  // Duration matches the fall-asleep animation in globals.css plus a small hold.
  const SLEEP_FADE_MS = 2200;
  const fallAsleepThenPlay = () => {
    setFallingAsleep(true);
    window.setTimeout(() => router.push("/play"), SLEEP_FADE_MS);
  };

  // Open the book on today's blank page (the spread after the last memory)
  useEffect(() => {
    const authenticated = isAuthenticated();
    if (!authenticated) {
      setAuthState("guest");
      return;
    }

    const stored = loadMemories();
    setMemories(stored);
    setSpreadIndex(stored.length);
    setAuthState("authenticated");
  }, [router]);

  useEffect(() => {
    if (authState === "authenticated" && memories !== null) {
      const timeout = window.setTimeout(() => setBookOpen(true), 120);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [authState, memories]);

  useEffect(() => {
    if (authState === "authenticated" && audioRef.current) {
      audioRef.current.play().catch(() => {
        // Autoplay may be blocked until the user interacts.
      });
    }
  }, [authState]);

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

  const startAudio = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {
        // Autoplay may be blocked; this is normal until the user interacts.
      });
    }
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

  if (authState === "unknown") {
    return (
      <div className="storybook-scene">
        <div className="storybook-card">
          <div className="text-center">
            <h2 className="storybook-heading">Play-Journal</h2>
            <p className="storybook-subtitle">An old storybook front door into your journal adventures.</p>
          </div>
          <p style={{ color: "#70543d", marginBottom: "1.5rem", textAlign: "center" }}>
            Gathering the ink of your memory...
          </p>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="storybook-button"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }


  if (authState === "guest") {
    return (
      <div className="storybook-scene">
        <div className="storybook-card">
          <div className="text-center">
            <h1 className="storybook-heading">The Play Journal</h1>
            <p className="storybook-subtitle">
              A tale told by your daily memories, transformed into a living game.
            </p>
          </div>

          <p style={{ color: "#70543d", marginBottom: "1.5rem", textAlign: "center" }}>
            Begin at the title page and unlock your story.
          </p>

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="storybook-button"
          >
            Open the Tome
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div
        className="tome-scene flex flex-col items-center justify-center px-3 pt-20"
        initial={{ opacity: 0, scale: 0.92, rotateX: 16, y: 32 }}
        animate={fallingAsleep ? { opacity: 0.2, scale: 1.35, rotateX: 0, y: -24 } : bookOpen ? { opacity: 1, scale: 1, rotateX: 0, y: 0 } : { opacity: 0, scale: 0.92, rotateX: 16, y: 32 }}
        transition={{ duration: fallingAsleep ? 2.1 : 0.9, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="tome-embers" aria-hidden />

        {memories !== null && (
          <Book spreads={spreads} index={spreadIndex} onIndexChange={setSpreadIndex} />
        )}
      </motion.div>

      {/* Sibling of .tome-scene: the fixed scene creates its own stacking
          context, so the overlay must live outside it to cover the nav bar. */}
      {fallingAsleep && <div className="sleep-fade" aria-hidden />}
      <audio
        ref={audioRef}
        src="https://cdn.pixabay.com/audio/2023/03/08/audio_9fff5c6221.mp3"
        loop
        preload="auto"
        style={{ display: "none" }}
      />
    </>
  );
}
