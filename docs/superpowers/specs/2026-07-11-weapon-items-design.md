# Weapon Items — Design

## Goal

A weapon data model + generation function: weapons are "containers" holding 1-3 attacks (randomly, weighted toward fewer), with base stats that differ by category. Melee and long-melee only for now - ranged weapons (with projectiles) are future work. No player-wielding, input, or hit-detection in this pass - data model and generation only, same as how `Attack.ts`/`StatusEffect.ts` were built before `EnemyCombat` wired them into gameplay.

## Scope

In scope: `Weapon` data model, category base stats, a separate weapon-attack catalog, weighted-random generation, two new status effects (`bonus_damage`, `charge_time`).

Out of scope: giving the player an attack input/action, hit detection, applying a weapon's attacks to anything, a damage/health system to actually consume `damage`/`bonus_damage`, ranged weapons/projectiles, weapon sprites (placeholders only, per existing project convention - e.g. `enemy_type` sat unused before `Enemy` existed).

## `src/game/combat/Weapon.ts` (new)

```ts
export type WeaponCategory = "melee" | "longMelee";
// "ranged" isn't included yet - added when that feature (with projectiles) lands.

export interface Weapon {
  id: string;
  category: WeaponCategory;
  damage: number;
  attackSpeedMs: number; // cooldown between swings - same convention as enemy attacks' cooldownMs
  rangeTiles: number;
  attackIds: string[]; // references into WEAPON_ATTACKS
}

const CATEGORY_BASE_STATS: Record<WeaponCategory, { damage: number; attackSpeedMs: number; rangeTiles: number }> = {
  melee: { damage: 15, attackSpeedMs: 500, rangeTiles: 1.5 },
  longMelee: { damage: 10, attackSpeedMs: 800, rangeTiles: 3 },
};
```

Base stats are **fixed per category**, not rolled ranges - a weapon's numeric stats come entirely from its category. What's randomized per generated instance is which attacks (and how many) get attached.

### Generation

```ts
export function generateWeapon(category: WeaponCategory): Weapon {
  const base = CATEGORY_BASE_STATS[category];
  const attackIds = pickAttackIds();
  return { id: crypto.randomUUID(), category, ...base, attackIds };
}
```

`crypto.randomUUID()` (standard Web/Node API, no new dependency) - tests assert uniqueness/shape of the result, not exact values.

- Attack count: 1-3, weighted toward fewer (~60% / 30% / 10% for 1/2/3).
- Attacks are selected **without replacement** from `WEAPON_ATTACKS` - a weapon never gets the same attack twice.
- Both the count-weighting and the unique-selection logic are small internal helper functions, unit-tested with a mocked `Math.random` (same pattern already used for `EnemyCombat`'s default selector).

## `src/game/combat/WeaponAttack.ts` (new)

A separate catalog from the enemy `ATTACKS`, thematically fitted to weapons rather than enemies. Reuses `AttackEffectApplication` (already generic) but drops the enemy-only fields (`minAggression`, `requiresLineOfSight`, `maxRangeTiles`) - a weapon's range/timing come from the `Weapon` itself, not per-attack, and nothing consumes a per-attack cooldown yet since wielding is out of scope.

```ts
export interface WeaponAttackDefinition {
  id: string;
  name: string;
  effects: AttackEffectApplication[]; // can be empty - a "plain hit" relying only on the weapon's damage stat
}

export const WEAPON_ATTACKS: WeaponAttackDefinition[] = [
  { id: "quick_slash", name: "Quick Slash", effects: [] },
  { id: "puncture", name: "Puncture", effects: [{ effectId: "slow", target: "target", durationMs: 2000 }] },
  { id: "intimidating_strike", name: "Intimidating Strike", effects: [{ effectId: "suppressed", target: "target", durationMs: 2500 }] },
  { id: "battle_focus", name: "Battle Focus", effects: [{ effectId: "unstoppable", target: "self", durationMs: 3000 }] },
  { id: "power_swing", name: "Power Swing", effects: [{ effectId: "bonus_damage", target: "self", durationMs: 2000 }] },
  { id: "heavy_strike", name: "Heavy Strike", effects: [{ effectId: "charge_time", target: "self", durationMs: 1200 }] },
];
```

## `src/game/combat/StatusEffect.ts` additions

Two new entries in the existing `STATUS_EFFECTS` catalog - reusing the exact same controller/badge-display machinery as `slow`/`suppressed`/`unstoppable` (they'll render as badges above whichever entity they're applied to automatically, via the existing `EntityLabel`, with no new UI work):

```ts
bonus_damage: {
  id: "bonus_damage",
  label: "BONUS DMG",
  color: "#f87171", // red-400
  tags: ["buff"],
  magnitude: 10, // extra damage while active
},
charge_time: {
  id: "charge_time",
  label: "CHARGING",
  color: "#fb923c", // orange-400
  tags: ["debuff"], // deliberately not "cc" - a self-imposed windup shouldn't be blockable by
                     // a future "unstoppable" self-buff the way enemy-inflicted CC is
},
```

## Tests

- **`Weapon.test.ts`**: `CATEGORY_BASE_STATS` sanity (melee has shorter range/faster speed/higher damage than longMelee, matching the design intent); `generateWeapon` produces 1-3 unique attack ids drawn only from `WEAPON_ATTACKS`; the weighted count distribution skews toward 1 (tested via a mocked `Math.random`, same approach as `EnemyCombat`'s default-selector test).
- **`WeaponAttack.test.ts`**: catalog invariant that every `effectId` referenced in `WEAPON_ATTACKS` exists in `STATUS_EFFECTS` (mirrors the existing `Attack.test.ts` check); unique attack ids.
- **`StatusEffect.test.ts`**: extend the existing "keys every definition under its own id" loop coverage naturally; add explicit checks that `bonus_damage` has a `magnitude` and `charge_time` does not carry the `cc` tag.
- No manual/browser verification needed for this pass - nothing in this plan touches `DungeonScene.ts`, Phaser, or any rendering path. Pure `vitest`/`tsc` verification only.
