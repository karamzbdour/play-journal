import type Phaser from "phaser";
import { CombatEntity } from "./EnemyCombat";
import { LineOfSightBlocker, hasLineOfSight } from "./lineOfSight";
import { Weapon } from "./Weapon";
import { WEAPON_ATTACKS, BASIC_ATTACK } from "./WeaponAttack";
import { resolveAttackComponents } from "./AttackComponent";
import { TILE_SIZE } from "../constants";

export interface AttackInput {
  isBasicAttackJustPressed(): boolean;
  isAbilityJustPressed(slot: 0 | 1 | 2): boolean;
}

function findNearestTarget(
  self: CombatEntity,
  enemies: CombatEntity[],
  maxRangeWorldUnits: number,
  blocker: LineOfSightBlocker
): CombatEntity | null {
  let nearest: CombatEntity | null = null;
  let nearestDistance = Infinity;

  for (const enemy of enemies) {
    const distance = Math.hypot(enemy.x - self.x, enemy.y - self.y);
    if (distance > maxRangeWorldUnits) continue;
    if (!hasLineOfSight(blocker, self.x, self.y, enemy.x, enemy.y)) continue;
    if (distance < nearestDistance) {
      nearest = enemy;
      nearestDistance = distance;
    }
  }

  return nearest;
}

export default class PlayerCombat {
  private basicAttackCooldownMs = 0;
  private abilityCooldowns: Map<string, number> = new Map();

  constructor(
    private weapon: Weapon,
    private self: CombatEntity,
    private getEnemies: () => CombatEntity[],
    private blocker: LineOfSightBlocker,
    private input: AttackInput
  ) {}

  update(deltaMs: number): void {
    this.basicAttackCooldownMs = Math.max(0, this.basicAttackCooldownMs - deltaMs);
    for (const [id, remaining] of this.abilityCooldowns) {
      const next = remaining - deltaMs;
      if (next <= 0) this.abilityCooldowns.delete(id);
      else this.abilityCooldowns.set(id, next);
    }

    if (this.input.isBasicAttackJustPressed()) this.tryBasicAttack();
    for (const slot of [0, 1, 2] as const) {
      if (this.input.isAbilityJustPressed(slot)) this.tryAbility(slot);
    }
  }

  private tryBasicAttack(): void {
    if (this.basicAttackCooldownMs > 0) return;
    this.basicAttackCooldownMs = this.weapon.attackSpeedMs;

    const target = findNearestTarget(
      this.self,
      this.getEnemies(),
      this.weapon.rangeTiles * TILE_SIZE,
      this.blocker
    );
    if (!target) return;
    resolveAttackComponents(BASIC_ATTACK.effects, this.self, target, this.weapon.damage);
  }

  private tryAbility(slot: 0 | 1 | 2): void {
    const attackId = this.weapon.attackIds[slot];
    if (!attackId) return;
    if ((this.abilityCooldowns.get(attackId) ?? 0) > 0) return;

    const definition = WEAPON_ATTACKS.find((a) => a.id === attackId);
    if (!definition) return;

    this.abilityCooldowns.set(attackId, definition.cooldownMs);

    const requiresTarget = definition.effects.some((component) => component.target === "target");
    const target = requiresTarget
      ? findNearestTarget(this.self, this.getEnemies(), this.weapon.rangeTiles * TILE_SIZE, this.blocker)
      : null;
    if (requiresTarget && !target) return;

    resolveAttackComponents(definition.effects, this.self, target, this.weapon.damage);
  }
}

type AttackKeyName = "space" | "q" | "w" | "e";

export class PhaserAttackInput implements AttackInput {
  private keys: Record<AttackKeyName, Phaser.Input.Keyboard.Key>;
  private wasDown: Record<AttackKeyName, boolean> = { space: false, q: false, w: false, e: false };

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard!;
    this.keys = {
      space: keyboard.addKey("SPACE"),
      q: keyboard.addKey("Q"),
      w: keyboard.addKey("W"),
      e: keyboard.addKey("E"),
    };
  }

  isBasicAttackJustPressed(): boolean {
    return this.justPressed("space");
  }

  isAbilityJustPressed(slot: 0 | 1 | 2): boolean {
    const name: AttackKeyName = slot === 0 ? "q" : slot === 1 ? "w" : "e";
    return this.justPressed(name);
  }

  private justPressed(name: AttackKeyName): boolean {
    const isDown = this.keys[name].isDown;
    const justPressed = isDown && !this.wasDown[name];
    this.wasDown[name] = isDown;
    return justPressed;
  }
}
