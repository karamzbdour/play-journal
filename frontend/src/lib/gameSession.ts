import { GameConfig } from "@/types/game";

const STORAGE_KEY = "play-journal:active-game-config";

export function saveGameConfig(config: GameConfig) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function loadGameConfig(): GameConfig | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GameConfig;
  } catch {
    return null;
  }
}

export function clearGameConfig() {
  sessionStorage.removeItem(STORAGE_KEY);
}
