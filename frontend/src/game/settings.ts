// Player-facing game settings, shared between the React settings menu and the
// Phaser scene. Persisted to localStorage; subscribers are notified on every
// change so a running scene reacts without a restart.

export interface GameSettings {
  /** Show the character's name above their head in the dungeon. */
  showPlayerName: boolean;
  /** Difficulty placeholder (1-10); stored but not wired to gameplay yet. */
  difficulty: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  showPlayerName: true,
  difficulty: 5,
};

const STORAGE_KEY = "play_journal_game_settings";

type Listener = (settings: GameSettings) => void;
const listeners = new Set<Listener>();
let current: GameSettings | null = null;

export function sanitizeSettings(raw: unknown): GameSettings {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_SETTINGS };
  const obj = raw as Record<string, unknown>;
  return {
    showPlayerName:
      typeof obj.showPlayerName === "boolean" ? obj.showPlayerName : DEFAULT_SETTINGS.showPlayerName,
    difficulty:
      typeof obj.difficulty === "number" && Number.isFinite(obj.difficulty)
        ? Math.min(10, Math.max(1, Math.round(obj.difficulty)))
        : DEFAULT_SETTINGS.difficulty,
  };
}

export function loadSettings(): GameSettings {
  if (current) return current;
  let stored: unknown = null;
  if (typeof window !== "undefined") {
    try {
      const json = window.localStorage.getItem(STORAGE_KEY);
      stored = json ? JSON.parse(json) : null;
    } catch {
      stored = null;
    }
  }
  current = sanitizeSettings(stored);
  return current;
}

export function updateSettings(patch: Partial<GameSettings>) {
  current = sanitizeSettings({ ...loadSettings(), ...patch });
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Storage full or unavailable; the in-memory value still works this session.
    }
  }
  listeners.forEach((fn) => fn(current!));
}

export function subscribeSettings(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
