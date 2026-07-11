import { WEAPON_ATTACKS } from "./WeaponAttack";

export type WeaponCategory = "melee" | "longMelee";

export interface Weapon {
  id: string;
  category: WeaponCategory;
  damage: number;
  attackSpeedMs: number;
  rangeTiles: number;
  attackIds: string[];
}

interface CategoryBaseStats {
  damage: number;
  attackSpeedMs: number;
  rangeTiles: number;
}

export const CATEGORY_BASE_STATS: Record<WeaponCategory, CategoryBaseStats> = {
  melee: { damage: 15, attackSpeedMs: 500, rangeTiles: 1.5 },
  longMelee: { damage: 10, attackSpeedMs: 800, rangeTiles: 3 },
};

// Uniform 50/50 pick - no design reason yet to weight one category over the other.
export function randomWeaponCategory(): WeaponCategory {
  return Math.random() < 0.5 ? "melee" : "longMelee";
}

// Weighted toward fewer attacks: 1 (60%), 2 (30%), 3 (10%).
export function randomAttackCount(): number {
  const roll = Math.random();
  if (roll < 0.6) return 1;
  if (roll < 0.9) return 2;
  return 3;
}

// Picks `count` unique items from `items` without replacement.
export function pickUnique<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool[index]);
    pool.splice(index, 1);
  }
  return picked;
}

export function generateWeapon(category: WeaponCategory): Weapon {
  const base = CATEGORY_BASE_STATS[category];
  const count = randomAttackCount();
  const attackIds = pickUnique(WEAPON_ATTACKS, count).map((a) => a.id);

  return {
    id: crypto.randomUUID(),
    category,
    ...base,
    attackIds,
  };
}
