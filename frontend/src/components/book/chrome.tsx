import React from "react";

// Shared page furniture for the tome's spreads.
// (Text formatters live in @/lib/format - they're used outside the book too.)

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
