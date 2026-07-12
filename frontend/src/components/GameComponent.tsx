"use client";

import { useEffect, useRef } from "react";
import type Phaser from "phaser";
import { GameConfig } from "@/types/game";
import { createDungeonScene } from "@/game/scenes/DungeonScene";
import { getMoodBackground } from "@/lib/moodTint";
import { caveat, silkscreen } from "@/lib/fonts";

interface GameComponentProps {
  config: GameConfig;
  onLevelComplete: () => void;
}

// Thin React/Phaser bootstrap: owns the container, the Phaser.Game lifecycle, and resizing.
// Actual gameplay lives in scene modules under src/game/, mirroring the module split used by
// https://github.com/mikewesthad/phaser-3-tilemap-blog-posts.
export default function GameComponent({ config, onLevelComplete }: GameComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  // Read via ref inside the effect so a fresh onLevelComplete identity each render doesn't
  // recreate the Phaser game (the effect only depends on config).
  const onLevelCompleteRef = useRef(onLevelComplete);
  onLevelCompleteRef.current = onLevelComplete;

  useEffect(() => {
    if (!containerRef.current) return;

    let isDestroyed = false;

    import("phaser").then((Phaser) => {
      if (isDestroyed) return;

      const DungeonScene = createDungeonScene(
        Phaser,
        config,
        silkscreen.style.fontFamily,
        caveat.style.fontFamily,
        () => onLevelCompleteRef.current()
      );

      const initialWidth = containerRef.current?.clientWidth || 800;
      const initialHeight = containerRef.current?.clientHeight || 600;

      const gameConfig: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: initialWidth,
        height: initialHeight,
        parent: containerRef.current,
        backgroundColor: getMoodBackground(config.mood),
        pixelArt: true,
        physics: {
          default: "arcade",
          arcade: { gravity: { x: 0, y: 0 }, debug: false },
        },
        scene: DungeonScene,
      };

      const game = new Phaser.Game(gameConfig);
      gameRef.current = game;

      const resizeObserver = new ResizeObserver((entries) => {
        if (!game || isDestroyed) return;
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          game.scale.resize(width, height);
        }
      });
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      return () => {
        isDestroyed = true;
        resizeObserver.disconnect();
        if (gameRef.current) {
          gameRef.current.destroy(true);
          gameRef.current = null;
        }
      };
    });

    return () => {
      isDestroyed = true;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [config]);

  return (
    <div className="w-full h-full min-h-[400px] relative overflow-hidden bg-slate-950">
      <div ref={containerRef} className="w-full h-full min-h-[400px] block" />
    </div>
  );
}
