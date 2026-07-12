// Picks a room strictly between the first and last rooms in the list (exclusive on both ends),
// so the boss room is never the room the player starts in or the room that holds the exit.
// Returns null if the dungeon didn't generate enough rooms for a valid middle choice.
export default function selectBossRoom<T>(rooms: readonly T[]): T | null {
  const candidates = rooms.slice(1, -1);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
