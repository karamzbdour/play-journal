"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

// One open view of the tome: a left and right page.
export interface Spread {
  left: React.ReactNode;
  right: React.ReactNode;
}

interface BookProps {
  spreads: Spread[];
  index: number;
  onIndexChange: (index: number) => void;
}

interface FlipState {
  dir: "next" | "prev";
  from: number;
  to: number;
  turned: boolean;
}

// Keep in sync with --leaf-turn-ms in globals.css
const LEAF_TURN_MS = 650;

// The flip renders the *destination* spread on the static pages while a
// single leaf (sized like the right page) rotates around the spine carrying
// the outgoing right page on its front and the incoming left page on its
// back. Committing the index once the leaf lands is therefore invisible.
export default function Book({ spreads, index, onIndexChange }: BookProps) {
  const [flip, setFlip] = useState<FlipState | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startFlip = useCallback(
    (dir: "next" | "prev") => {
      if (flip) return;
      const to = dir === "next" ? index + 1 : index - 1;
      if (to < 0 || to >= spreads.length) return;

      // Stacked-page mobile layout and reduced motion both skip the 3D leaf
      const instant =
        window.matchMedia("(max-width: 719px)").matches ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (instant) {
        onIndexChange(to);
        return;
      }

      setFlip({ dir, from: index, to, turned: false });
      // Double rAF so the leaf paints at its start rotation before turning
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFlip((f) => (f ? { ...f, turned: true } : f));
        });
      });
      commitTimer.current = setTimeout(() => {
        onIndexChange(to);
        setFlip(null);
      }, LEAF_TURN_MS + 40);
    },
    [flip, index, spreads.length, onIndexChange]
  );

  useEffect(() => {
    return () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
    };
  }, []);

  // Arrow-key navigation, unless the user is writing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      if (e.key === "ArrowRight") startFlip("next");
      if (e.key === "ArrowLeft") startFlip("prev");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [startFlip]);

  const current = spreads[index];
  if (!current) return null;

  const leftContent = flip
    ? flip.dir === "next"
      ? spreads[flip.from].left
      : spreads[flip.to].left
    : current.left;
  const rightContent = flip
    ? flip.dir === "next"
      ? spreads[flip.to].right
      : spreads[flip.from].right
    : current.right;

  const leafFront = flip
    ? flip.dir === "next"
      ? spreads[flip.from].right
      : spreads[flip.to].right
    : null;
  const leafBack = flip
    ? flip.dir === "next"
      ? spreads[flip.to].left
      : spreads[flip.from].left
    : null;

  const leafClass = flip
    ? flip.dir === "next"
      ? flip.turned
        ? "tome-leaf tome-leaf--turned"
        : "tome-leaf tome-leaf--start"
      : flip.turned
        ? "tome-leaf tome-leaf--turned-flipped"
        : "tome-leaf tome-leaf--start-flipped"
    : "";

  const shownIndex = flip ? flip.to : index;

  return (
    <div className="tome">
      <div className="tome-page-stack tome-page-stack--left" aria-hidden />
      <div className="tome-page-stack tome-page-stack--right" aria-hidden />

      <div className="tome-spread">
        <div className="tome-page tome-page--left">{leftContent}</div>
        <div className="tome-page tome-page--right">{rightContent}</div>

        {flip && (
          <div className={leafClass} aria-hidden>
            <div className="tome-leaf-face">
              <div className="tome-page tome-page--right">{leafFront}</div>
            </div>
            <div className="tome-leaf-face tome-leaf-face--back">
              <div className="tome-page tome-page--left">{leafBack}</div>
            </div>
          </div>
        )}
      </div>

      <button
        className="tome-corner tome-corner--prev"
        onClick={() => startFlip("prev")}
        disabled={shownIndex <= 0}
        aria-label="Previous page"
      >
        ◄
      </button>
      <button
        className="tome-corner tome-corner--next"
        onClick={() => startFlip("next")}
        disabled={shownIndex >= spreads.length - 1}
        aria-label="Next page"
      >
        ►
      </button>
    </div>
  );
}
