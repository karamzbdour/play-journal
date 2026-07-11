export interface AttackEffectApplication {
  effectId: string;
  target: "self" | "target";
  durationMs: number;
}

export interface AttackDefinition {
  id: string;
  name: string;
  minAggression: number;
  cooldownMs: number;
  effects: AttackEffectApplication[];
  requiresLineOfSight?: boolean;
  maxRangeTiles?: number;
}

export const ATTACKS: AttackDefinition[] = [
  {
    id: "brace",
    name: "Brace",
    minAggression: 1,
    cooldownMs: 5000,
    effects: [{ effectId: "unstoppable", target: "self", durationMs: 3000 }],
    requiresLineOfSight: true,
    maxRangeTiles: 8,
  },
  {
    id: "nagging_reminder",
    name: "Nagging Reminder",
    minAggression: 2,
    cooldownMs: 4000,
    effects: [{ effectId: "slow", target: "target", durationMs: 2000 }],
    requiresLineOfSight: true,
    maxRangeTiles: 8,
  },
  {
    id: "silencing_glare",
    name: "Silencing Glare",
    minAggression: 3,
    cooldownMs: 6000,
    effects: [{ effectId: "suppressed", target: "target", durationMs: 2500 }],
    requiresLineOfSight: true,
    maxRangeTiles: 8,
  },
];
