import type Phaser from "phaser";
import { CombatEntity } from "./CombatEntity";
import { LineOfSightBlocker, hasLineOfSight } from "./lineOfSight";
import { Weapon } from "./Weapon";
import { WEAPON_ATTACKS, BASIC_ATTACK } from "./WeaponAttack";
import { resolveAttackComponents } from "./AttackComponent";
import CooldownTracker from "./CooldownTracker";
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
  // Holds the basic attack (keyed by BASIC_ATTACK.id, gated by the weapon's
  // attack speed) alongside ability cooldowns; the id pools don't overlap.
  private cooldowns = new CooldownTracker();

  constructor(
    private weapon: Weapon,
    private self: CombatEntity,
    private getEnemies: () => CombatEntity[],
    private blocker: LineOfSightBlocker,
    private input: AttackInput,
    private options: { onAttack?: (attackId: string) => void } = {}
  ) {}

  update(deltaMs: number): void {
    this.cooldowns.tick(deltaMs);

    if (this.input.isBasicAttackJustPressed()) this.tryBasicAttack();
    for (const slot of [0, 1, 2] as const) {
      if (this.input.isAbilityJustPressed(slot)) this.tryAbility(slot);
    }
  }

  private tryBasicAttack(): void {
    if (!this.cooldowns.isReady(BASIC_ATTACK.id)) return;
    this.cooldowns.start(BASIC_ATTACK.id, this.weapon.attackSpeedMs);

    const target = findNearestTarget(
      this.self,
      this.getEnemies(),
      this.weapon.rangeTiles * TILE_SIZE,
      this.blocker
    );
    if (!target) return;
    resolveAttackComponents(BASIC_ATTACK.effects, this.self, target, this.weapon.damage);
    this.options.onAttack?.(BASIC_ATTACK.id);
  }

  private tryAbility(slot: 0 | 1 | 2): void {
    const attackId = this.weapon.attackIds[slot];
    if (!attackId) return;
    if (!this.cooldowns.isReady(attackId)) return;

    const definition = WEAPON_ATTACKS.find((a) => a.id === attackId);
    if (!definition) return;

    this.cooldowns.start(attackId, definition.cooldownMs);

    const requiresTarget = definition.effects.some((component) => component.target === "target");
    const target = requiresTarget
      ? findNearestTarget(this.self, this.getEnemies(), this.weapon.rangeTiles * TILE_SIZE, this.blocker)
      : null;
    if (requiresTarget && !target) return;

    resolveAttackComponents(definition.effects, this.self, target, this.weapon.damage);
    this.options.onAttack?.(attackId);
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
