export type EffectTag = "cc" | "buff" | "debuff";

export interface StatusEffectDefinition {
  id: string;
  label: string;
  color: string;
  tags: EffectTag[];
  blocksTags?: EffectTag[];
  magnitude?: number;
}

export const STATUS_EFFECTS: Record<string, StatusEffectDefinition> = {
  slow: {
    id: "slow",
    label: "SLOW",
    color: "#38bdf8",
    tags: ["cc", "debuff"],
    magnitude: 0.5,
  },
  suppressed: {
    id: "suppressed",
    label: "SUPPRESSED",
    color: "#a855f7",
    tags: ["cc", "debuff"],
  },
  unstoppable: {
    id: "unstoppable",
    label: "UNSTOPPABLE",
    color: "#facc15",
    tags: ["buff"],
    blocksTags: ["cc"],
  },
  bonus_damage: {
    id: "bonus_damage",
    label: "BONUS DMG",
    color: "#f87171",
    tags: ["buff"],
    magnitude: 10,
  },
  charge_time: {
    id: "charge_time",
    label: "CHARGING",
    color: "#fb923c",
    tags: ["debuff"],
  },
  lunge: {
    id: "lunge",
    label: "LUNGE",
    color: "#f59e0b",
    tags: ["buff"],
  },
  block: {
    id: "block",
    label: "BLOCK",
    color: "#60a5fa",
    tags: ["buff"],
    blocksTags: ["cc"],
    magnitude: 0.5,
  },
  poison: {
    id: "poison",
    label: "POISON",
    color: "#22c55e",
    tags: ["debuff"],
    magnitude: 0.02,
  },
};
