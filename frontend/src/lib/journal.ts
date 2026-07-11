import { GameConfig } from "@/types/game";

// A filled page of the tome: what was written, when, and the dungeon it generated
// (kept so any past page can be relived without re-calling the backend).
export interface MemoryEntry {
  id: string;
  date: string; // ISO timestamp at save time
  text: string;
  config: GameConfig;
}

const STORAGE_KEY = "play-journal:memories";

export function loadMemories(): MemoryEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MemoryEntry[]) : [];
  } catch {
    return [];
  }
}

// Saving is best-effort: if localStorage is unavailable or full, the game
// handoff (sessionStorage, see gameSession.ts) still works - the memory just
// won't appear as a page next time.
export function saveMemory(text: string, config: GameConfig): MemoryEntry {
  const entry: MemoryEntry = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    text,
    config,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...loadMemories(), entry]));
  } catch (err) {
    console.error("Failed to save memory to localStorage:", err);
  }
  return entry;
}
