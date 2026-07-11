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
};
