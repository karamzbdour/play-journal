import { AttackComponent } from "./AttackComponent";

export interface WeaponAttackDefinition {
  id: string;
  name: string;
  cooldownMs: number;
  effects: AttackComponent[];
}

export const WEAPON_ATTACKS: WeaponAttackDefinition[] = [
  {
    id: "quick_slash",
    name: "Quick Slash",
    cooldownMs: 2000,
    effects: [{ kind: "damage", target: "target", amount: 10 }],
  },
  {
    id: "puncture",
    name: "Puncture",
    cooldownMs: 3000,
    effects: [
      { kind: "status", effectId: "slow", target: "target", durationMs: 2000 },
      { kind: "damage", target: "target", amount: 12 },
    ],
  },
  {
    id: "intimidating_strike",
    name: "Intimidating Strike",
    cooldownMs: 4000,
    effects: [
      { kind: "status", effectId: "suppressed", target: "target", durationMs: 2500 },
      { kind: "damage", target: "target", amount: 8 },
    ],
  },
  {
    id: "battle_focus",
    name: "Battle Focus",
    cooldownMs: 5000,
    effects: [{ kind: "status", effectId: "unstoppable", target: "self", durationMs: 3000 }],
  },
  {
    id: "power_swing",
    name: "Power Swing",
    cooldownMs: 4000,
    effects: [{ kind: "status", effectId: "bonus_damage", target: "self", durationMs: 2000 }],
  },
  {
    id: "heavy_strike",
    name: "Heavy Strike",
    cooldownMs: 3000,
    effects: [{ kind: "status", effectId: "charge_time", target: "self", durationMs: 1200 }],
  },
  {
    id: "lunge_attack",
    name: "Lunge Attack",
    cooldownMs: 3500,
    effects: [
      { kind: "status", effectId: "lunge", target: "self", durationMs: 1000 },
      { kind: "damage", target: "target", amount: 14 },
    ],
  },
  {
    id: "block",
    name: "Block",
    cooldownMs: 2500,
    effects: [{ kind: "status", effectId: "block", target: "self", durationMs: 2000 }],
  },
];

// The player's default attack (SPACE) - not part of the randomized `attackIds` pool.
// Its damage component omits `amount`, so PlayerCombat resolves it against the wielder's
// weapon.damage instead of a fixed number, keeping weapon.damage a meaningful, buffable stat.
export const BASIC_ATTACK: WeaponAttackDefinition = {
  id: "basic_attack",
  name: "Basic Attack",
  cooldownMs: 0, // unused - PlayerCombat gates this by weapon.attackSpeedMs instead
  effects: [
    { kind: "damage", target: "target" },
    { kind: "status", effectId: "slow", target: "target", durationMs: 500 },
  ],
};
