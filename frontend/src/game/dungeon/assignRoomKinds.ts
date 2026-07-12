import { RoomKind } from "./RoomKind";

export interface RoomKindQuota {
  kind: RoomKind;
  count: number;
}

// How many of a dungeon's rooms should get each special kind.
export default function assignRoomKinds<T>(
  rooms: readonly T[],
  quotas: readonly RoomKindQuota[]
): Map<T, RoomKind> {
  // Candidates exclude the first room (player start) and the last room (holds the stairs), so a
  // special room can never be the spawn room or seal the player out of the exit.
  const candidates = rooms.slice(1, -1).slice();

  // Fisher-Yates shuffle so which rooms get picked doesn't depend on generation order, and so
  // earlier quotas in the list don't systematically get first pick of "better" rooms.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const assignments = new Map<T, RoomKind>();
  let cursor = 0;
  for (const quota of quotas) {
    for (let i = 0; i < quota.count && cursor < candidates.length; i++, cursor++) {
      assignments.set(candidates[cursor], quota.kind);
    }
  }
  return assignments;
}
