import { TILE_SIZE } from "../constants";

export interface LineOfSightBlocker {
  isBlocked(x: number, y: number): boolean;
}

export function isWithinRange(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  maxRangeWorldUnits: number
): boolean {
  return Math.hypot(toX - fromX, toY - fromY) <= maxRangeWorldUnits;
}

export function hasLineOfSight(
  blocker: LineOfSightBlocker,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): boolean {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const steps = Math.ceil(Math.hypot(dx, dy) / (TILE_SIZE / 4));

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocker.isBlocked(fromX + dx * t, fromY + dy * t)) return false;
  }

  return true;
}
