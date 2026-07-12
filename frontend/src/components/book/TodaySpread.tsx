import React from "react";
import { Spread } from "./Book";
import { PageNo } from "./chrome";
import { formatDate } from "@/lib/format";

interface TodaySpreadProps {
  spreadIndex: number;
  journalText: string;
  onJournalTextChange: (text: string) => void;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  onPreviewMock: () => void;
}

// The tome's final spread: a scribe's note on the left (doubles as onboarding
// when the book is empty) and today's blank page on the right.
export default function todaySpread({
  spreadIndex,
  journalText,
  onJournalTextChange,
  loading,
  error,
  onGenerate,
  onPreviewMock,
}: TodaySpreadProps): Spread {
  const left = (
    <div className="tome-page-inner">
      {/* Completely empty */}
    </div>
  );

  const right = (
    <div className="tome-page-inner">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span className="tome-heading">Today&apos;s page</span>
        <span className="tome-eyebrow">{formatDate(new Date().toISOString())}</span>
      </div>

      <textarea
        className="tome-write"
        style={{ marginTop: "1.1rem" }}
        value={journalText}
        onChange={(e) => onJournalTextChange(e.target.value)}
        placeholder="How was your day? Write code? Throw a party? Walk in the rain?"
        aria-label="Today's journal entry"
      />

      {error && (
        <p
          className="tome-hand"
          style={{ color: "var(--ink-blood)", marginTop: "0.6rem" }}
          role="alert"
        >
          {error}
        </p>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          marginTop: "1rem",
          flexWrap: "wrap",
        }}
      >
        <button
          className="tome-btn tome-btn-slide"
          onClick={onGenerate}
          disabled={loading || !journalText.trim()}
        >
          {loading ? "Conjuring the dungeon…" : "Relive this day"}
        </button>
        <button
          className="tome-eyebrow"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
          onClick={onPreviewMock}
        >
          Practice run (mock data)
        </button>
      </div>

      <PageNo n={spreadIndex * 2 + 2} side="right" />
    </div>
  );

  return { left, right };
}
