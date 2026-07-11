import React from "react";

// Shared page furniture for the tome's spreads.

// "deadline_demon" -> "Deadline Demon"
export function prettifyName(slug: string): string {
  return slug
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ISO timestamp -> "12 Jul 2026"
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function PageNo({ n, side }: { n: number; side: "left" | "right" }) {
  return (
    <div
      className="tome-eyebrow"
      style={{
        marginTop: "auto",
        paddingTop: "0.75rem",
        textAlign: side,
      }}
    >
      {n}
    </div>
  );
}
