"use client";

import { useState } from "react";
import { GameSettings, loadSettings, updateSettings } from "@/game/settings";

// Gear button pinned to the top-right of the play screen. Opens a small panel
// with live game settings; changes are pushed through the settings store so
// the running Phaser scene picks them up immediately.
export default function GameSettingsMenu() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());

  const apply = (patch: Partial<GameSettings>) => {
    updateSettings(patch);
    setSettings(loadSettings());
  };

  return (
    <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Game settings"
        className="text-xs px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 backdrop-blur-md transition font-semibold"
      >
        ⚙ Settings
      </button>

      {open && (
        <div className="w-64 p-4 rounded-lg bg-slate-900/90 border border-slate-800 backdrop-blur-md text-slate-200 shadow-xl space-y-4">
          <label className="flex items-center justify-between gap-3 text-sm cursor-pointer">
            <span>Show character name</span>
            <input
              type="checkbox"
              checked={settings.showPlayerName}
              onChange={(e) => apply({ showPlayerName: e.target.checked })}
              className="h-4 w-4 accent-sky-500 cursor-pointer"
            />
          </label>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>Difficulty</span>
              <span className="text-slate-400 tabular-nums">{settings.difficulty}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={settings.difficulty}
              onChange={(e) => apply({ difficulty: Number(e.target.value) })}
              aria-label="Difficulty"
              className="w-full accent-sky-500"
            />
            <p className="text-[11px] text-slate-500">
              Placeholder — doesn&apos;t affect gameplay yet.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
