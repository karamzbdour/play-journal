import React from "react";
import { MemoryEntry } from "@/lib/journal";
import { getPalette } from "@/lib/theme";
import { Spread } from "./Book";
import { PageNo } from "./chrome";
import { formatDate, prettifyName } from "@/lib/format";

// Same clamp DungeonScene uses for maxRooms, so the card's "depth" matches
// what the player actually walks through when they relive the memory.
function dungeonDepth(lengthOfDay: number): number {
  if (!Number.isFinite(lengthOfDay)) return 5;
  return Math.round(Math.min(10, Math.max(5, lengthOfDay)));
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="tome-stat-row">
      <span style={{ color: "var(--ink-faded)" }}>{label}</span>
      <span className="leader" />
      <span>{value}</span>
    </div>
  );
}

// A filled spread: left page is the run card (the day as a roguelite codex
// entry), right page is the memory as written.
export default function memorySpread(
  entry: MemoryEntry,
  spreadIndex: number,
  onRelive: (entry: MemoryEntry) => void
): Spread {
  const { config } = entry;
  const palette = getPalette(config.theme_id);
  const boss = config.bosses?.[0];

  const left = (
    <div className="tome-page-inner">
      <div className="tome-eyebrow">Day of {formatDate(entry.date)}</div>
      <h2
        className="tome-heading"
        style={{
          marginTop: "0.9rem",
          color: `color-mix(in srgb, ${palette.playerColor} 55%, var(--ink))`,
        }}
      >
        {config.theme_name}
      </h2>

      <div
        aria-hidden
        style={{ display: "flex", gap: "6px", marginTop: "0.8rem" }}
      >
        {[palette.playerColor, palette.collectibleColor, palette.bossColor].map(
          (c) => (
            <span
              key={c}
              style={{
                width: "12px",
                height: "12px",
                background: c,
                boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.25)",
              }}
            />
          )
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.85rem",
          marginTop: "1.6rem",
        }}
      >
        <StatRow label="Mood" value={prettifyName(config.mood)} />
        <StatRow label="Depth" value={`${dungeonDepth(config.length_of_day)} rooms`} />
        <StatRow label="Foe" value={prettifyName(config.enemy_type)} />
        {boss && <StatRow label="Boss" value={prettifyName(boss)} />}
        <StatRow label="Weapon" value={prettifyName(config.weapon)} />
      </div>

      <button
        className="tome-btn tome-btn-slide"
        style={{ marginTop: "1.8rem", alignSelf: "flex-start" }}
        onClick={() => onRelive(entry)}
      >
        Relive this memory
      </button>

      <PageNo n={spreadIndex * 2 + 1} side="left" />
    </div>
  );

  const right = (
    <div className="tome-page-inner">
      <div className="tome-eyebrow" style={{ textAlign: "right" }}>
        The memory
      </div>
      <p
        className="tome-hand"
        style={{ marginTop: "1rem", whiteSpace: "pre-wrap" }}
      >
        {entry.text}
      </p>
      <PageNo n={spreadIndex * 2 + 2} side="right" />
    </div>
  );

  return { left, right };
}
