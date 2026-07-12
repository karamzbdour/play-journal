"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { MemoryEntry, loadMemories } from "@/lib/journal";
import { formatDate } from "@/lib/format";

export default function JournalPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<MemoryEntry[]>([]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    setEntries(loadMemories());
  }, [router]);

  return (
    <div className="tome-scene flex flex-col items-center justify-start min-h-screen px-4 pt-28 pb-12 overflow-y-auto">
      <div 
        className="w-full max-w-2xl p-8 border-2 rounded-lg shadow-2xl relative z-10 flex flex-col gap-6"
        style={{
          background: "linear-gradient(145deg, #1f120a 0%, #170d07 100%)",
          borderColor: "#4a3325",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.9)"
        }}
      >
        <div className="text-center border-b pb-4" style={{ borderColor: "#3e271a" }}>
          <h1 
            className="text-3xl font-extrabold uppercase tracking-widest"
            style={{ 
              color: "var(--torch)", 
              textShadow: "0 0 15px rgba(251,191,36,0.3)" 
            }}
          >
            Chronicles of Days
          </h1>
          <p className="text-xs mt-1" style={{ color: "#8a7550" }}>
            The historical record of your past quests and games
          </p>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-12 flex flex-col gap-4 items-center">
            <span className="text-4xl">📭</span>
            <p className="text-sm font-medium" style={{ color: "#a18262" }}>
              Your chronicle is empty. Return to the Home Tome and record your first day!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {entries.map((entry, index) => (
              <div 
                key={index}
                className="p-5 border rounded flex flex-col gap-3 transition-all hover:translate-x-1"
                style={{
                  background: "#120804",
                  borderColor: "#3e271a",
                }}
              >
                <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider" style={{ color: "#8a7550" }}>
                  <span>Day #{index + 1}</span>
                  <span>{formatDate(entry.date)}</span>
                </div>
                <p className="text-sm italic" style={{ color: "#d9c69e", fontFamily: "var(--font-sans)" }}>
                  &ldquo;{entry.text}&rdquo;
                </p>
                <div className="flex gap-2 items-center text-xs">
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold" style={{ background: "#2e1a0c", color: "var(--torch)" }}>
                    Theme: {entry.config.theme_name}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold" style={{ background: "#2e1a0c", color: "#a18262" }}>
                    Mood: {entry.config.mood}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
