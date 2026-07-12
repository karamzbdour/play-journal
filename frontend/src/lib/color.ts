// "#facc15" -> 0xfacc15, the numeric form Phaser's fill APIs take.
export function hexToNumber(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}
