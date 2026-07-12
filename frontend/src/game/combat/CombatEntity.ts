import { ResolvableEntity } from "./AttackComponent";

// Anything that can fight or be fought: attack *targeting* needs a world
// position on top of the status/health hooks attack *resolution* needs.
export interface CombatEntity extends ResolvableEntity {
  x: number;
  y: number;
}

export interface AggressiveCombatEntity extends CombatEntity {
  aggressionLevel: number;
}
