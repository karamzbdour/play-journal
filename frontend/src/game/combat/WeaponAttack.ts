import { AttackEffectApplication } from "./Attack";

export interface WeaponAttackDefinition {
  id: string;
  name: string;
  effects: AttackEffectApplication[];
}

export const WEAPON_ATTACKS: WeaponAttackDefinition[] = [
  { id: "quick_slash", name: "Quick Slash", effects: [] },
  { id: "puncture", name: "Puncture", effects: [{ effectId: "slow", target: "target", durationMs: 2000 }] },
  {
    id: "intimidating_strike",
    name: "Intimidating Strike",
    effects: [{ effectId: "suppressed", target: "target", durationMs: 2500 }],
  },
  {
    id: "battle_focus",
    name: "Battle Focus",
    effects: [{ effectId: "unstoppable", target: "self", durationMs: 3000 }],
  },
  {
    id: "power_swing",
    name: "Power Swing",
    effects: [{ effectId: "bonus_damage", target: "self", durationMs: 2000 }],
  },
  {
    id: "heavy_strike",
    name: "Heavy Strike",
    effects: [{ effectId: "charge_time", target: "self", durationMs: 1200 }],
  },
];
