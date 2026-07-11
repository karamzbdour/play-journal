import { AttackEffectApplication } from "./Attack";

export interface WeaponAttackDefinition {
  id: string;
  name: string;
  cooldownMs: number;
  effects: AttackEffectApplication[];
}

export const WEAPON_ATTACKS: WeaponAttackDefinition[] = [
  { id: "quick_slash", name: "Quick Slash", cooldownMs: 2000, effects: [] },
  {
    id: "puncture",
    name: "Puncture",
    cooldownMs: 3000,
    effects: [{ effectId: "slow", target: "target", durationMs: 2000 }],
  },
  {
    id: "intimidating_strike",
    name: "Intimidating Strike",
    cooldownMs: 4000,
    effects: [{ effectId: "suppressed", target: "target", durationMs: 2500 }],
  },
  {
    id: "battle_focus",
    name: "Battle Focus",
    cooldownMs: 5000,
    effects: [{ effectId: "unstoppable", target: "self", durationMs: 3000 }],
  },
  {
    id: "power_swing",
    name: "Power Swing",
    cooldownMs: 4000,
    effects: [{ effectId: "bonus_damage", target: "self", durationMs: 2000 }],
  },
  {
    id: "heavy_strike",
    name: "Heavy Strike",
    cooldownMs: 3000,
    effects: [{ effectId: "charge_time", target: "self", durationMs: 1200 }],
  },
];
