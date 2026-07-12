"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

// One open view of the tome: a left and right page.
export interface Spread {
  left: React.ReactNode;
  right: React.ReactNode;
}

interface BookProps {
  spreads: Spread[];
  index: number;
  onIndexChange: (index: number) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FlipState {
  dir: "next" | "prev";
  from: number;
  to: number;
  turned: boolean;
}

// Keep in sync with --leaf-turn-ms in globals.css
const LEAF_TURN_MS = 650;

export default function Book({ spreads, index, onIndexChange, isOpen, onOpenChange }: BookProps) {
  const [isCoverFullyOpen, setIsCoverFullyOpen] = useState(false);
  const [flip, setFlip] = useState<FlipState | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startFlip = useCallback(
    (dir: "next" | "prev") => {
      if (flip || !isOpen) return;
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
    [flip, index, spreads.length, onIndexChange, isOpen]
  );

  useEffect(() => {
    const handleClose = () => {
      onOpenChange(false);
      setIsCoverFullyOpen(false);
    };
    window.addEventListener("close-book", handleClose);
    return () => {
      window.removeEventListener("close-book", handleClose);
      if (commitTimer.current) clearTimeout(commitTimer.current);
    };
  }, [onOpenChange]);

  // Arrow-key navigation, unless the user is writing or the book is closed
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      if (e.key === "ArrowRight") startFlip("next");
      if (e.key === "ArrowLeft") startFlip("prev");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [startFlip, isOpen]);

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
    <motion.div
      layout
      className={`tome ${!isOpen ? "tome-closed cursor-pointer select-none" : ""}`}
      style={{
        width: isOpen ? "min(1140px, 92vw)" : "min(540px, 44vw)",
        cursor: !isOpen ? "pointer" : "default",
        background: "linear-gradient(145deg, #3a2517 0%, var(--leather) 45%, #1f1109 100%)",
        border: "2px solid var(--leather-edge)",
        borderRadius: "6px 10px 10px 6px",
        boxShadow: "0 30px 60px -12px rgba(0, 0, 0, 0.85), 0 0 90px -20px rgba(251, 191, 36, 0.18)",
        padding: !isOpen ? 0 : undefined,
      }}
      animate={{
        x: isOpen ? ["0%", "12%", "-12%"] : "0%",
      }}
      whileHover={
        !isOpen
          ? {
              y: -10,
              scale: 1.02,
              boxShadow:
                "0 45px 80px -10px rgba(0, 0, 0, 0.95), 0 0 110px -10px rgba(251, 191, 36, 0.35)",
            }
          : undefined
        }
        transition={{
          width: { type: "spring", stiffness: 80, damping: 20 },
          x: isOpen
            ? {
                times: [0, 0.2, 1],
                duration: 1.1,
                ease: "easeInOut",
              }
            : { type: "spring", stiffness: 90, damping: 18 },
          layout: { type: "spring", stiffness: 80, damping: 20 },
          boxShadow: { type: "tween", duration: 0.5, ease: "easeOut" },
        }}
      >
        {/* Open pages layer */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
            className="h-full w-full flex flex-col relative"
          >
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
          </motion.div>
        )}

        {/* Cover Overlay Layer */}
        {!isCoverFullyOpen && (
          <motion.div
            key="closed-cover"
            initial={{ rotateY: 0, left: 0 }}
            animate={{
              rotateY: isOpen ? -180 : 0,
              left: isOpen ? "50%" : 0,
            }}
            transition={{
              rotateY: { duration: 1.1, ease: [0.4, 0, 0.2, 1] },
              left: { type: "spring", stiffness: 80, damping: 20 },
            }}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: isOpen ? "50%" : 0,
              right: 0,
              transformOrigin: "left center",
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
              zIndex: 50,
              background: "linear-gradient(145deg, #3a2517 0%, var(--leather) 45%, #1f1109 100%)",
              border: "2px solid var(--leather-edge)",
              borderRadius: "0 6px 6px 0",
              boxShadow: "0 30px 60px -12px rgba(0, 0, 0, 0.85)",
            }}
            onAnimationComplete={() => {
              if (isOpen) {
                setIsCoverFullyOpen(true);
              }
            }}
            className="h-full flex items-center justify-center p-8 overflow-hidden cursor-pointer select-none"
            onClick={!isOpen ? () => onOpenChange(true) : undefined}
          >
            {/* Subtle Glowing Center Background Effect */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.15)_0%,transparent_60%)] pointer-events-none" />

            {/* Elegant Thin Border */}
            <div className="absolute inset-4 border border-[#fbbf24]/20 pointer-events-none rounded-sm" />

            {/* Corner Ornaments */}
            <div className="absolute top-6 left-6 w-3 h-3 border-t border-l border-[#fbbf24]/40 pointer-events-none" />
            <div className="absolute top-6 right-6 w-3 h-3 border-t border-r border-[#fbbf24]/40 pointer-events-none" />
            <div className="absolute bottom-6 left-6 w-3 h-3 border-b border-l border-[#fbbf24]/40 pointer-events-none" />
            <div className="absolute bottom-6 right-6 w-3 h-3 border-b border-r border-[#fbbf24]/40 pointer-events-none" />

            <div className="flex flex-col items-center justify-center z-10">
              {/* Simple Cursive Serif Title */}
              <h1 
                className="text-5xl tracking-wide text-center"
                style={{ 
                  color: "#fbbf24", 
                  textShadow: "0 2px 8px rgba(0,0,0,0.8), 0 0 15px rgba(251,191,36,0.3)",
                  fontFamily: "Caveat, var(--font-caveat), cursive"
                }}
              >
                Play-Journal
              </h1>
              
              {/* Gold foil ribbon divider */}
              <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-[#fbbf24]/50 to-transparent mt-4" />
            </div>
          </motion.div>
        )}
      </motion.div>
  );
}
