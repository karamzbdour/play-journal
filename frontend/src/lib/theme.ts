export interface ThemePalette {
  playerColor: string;
  collectibleColor: string;
  bossColor: string;
}

const PALETTES: Record<string, ThemePalette> = {
  coder_coffee: {
    playerColor: "#38bdf8", // sky-400
    collectibleColor: "#b45309", // amber-700
    bossColor: "#f87171", // red-400
  },
  party_star: {
    playerColor: "#fcd34d", // amber-300
    collectibleColor: "#a855f7", // purple-500
    bossColor: "#ec4899", // pink-500
  },
  rainy_day: {
    playerColor: "#cbd5e1", // slate-300
    collectibleColor: "#10b981", // emerald-500
    bossColor: "#60a5fa", // blue-400
  },
  daily_quest: {
    playerColor: "#22c55e", // green-500
    collectibleColor: "#eab308", // yellow-500
    bossColor: "#d97706", // amber-600
  },
};

const DEFAULT_PALETTE: ThemePalette = PALETTES.daily_quest;

export function getPalette(themeId: string): ThemePalette {
  return PALETTES[themeId] ?? DEFAULT_PALETTE;
}
