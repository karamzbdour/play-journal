import type Phaser from "phaser";
import { STATUS_EFFECTS } from "../combat/StatusEffect";

export interface NamePlateTarget {
  x: number;
  y: number;
}

export interface StatusEffectSource {
  getActiveIds(): string[];
  getRemainingRatio(effectId: string): number;
}

export interface HealthSource {
  getRatio(): number;
}

export interface EntityLabelOptions {
  name?: string;
  statusEffects?: StatusEffectSource;
  health?: HealthSource;
  offsetY?: number;
  color?: string;
  fontSize?: string;
}

const DEFAULT_OFFSET_Y = 18;
const DEFAULT_COLOR = "#f8fafc";
const DEFAULT_FONT_SIZE = "12px";
const BADGE_FONT_SIZE = "10px";
const BADGE_STACK_GAP = 14;
const BADGE_LINE_HEIGHT = 19;
const BAR_WIDTH = 40;
const BAR_HEIGHT = 3;
const BAR_GAP = 2;
const HP_BAR_WIDTH = 44;
const HP_BAR_HEIGHT = 6;
const HP_BAR_COLOR = 0x22c55e;
const HP_BAR_BG_COLOR = 0x000000;
const HP_BAR_BG_ALPHA = 0.5;
const NAME_TO_HP_GAP = 8;
const HP_TO_BADGE_GAP = 8;

export function diffBadgeIds(previous: string[], current: string[]): { added: string[]; removed: string[] } {
  const previousSet = new Set(previous);
  const currentSet = new Set(current);
  return {
    added: current.filter((id) => !previousSet.has(id)),
    removed: previous.filter((id) => !currentSet.has(id)),
  };
}

export default class EntityLabel {
  private scene: Phaser.Scene;
  private fontFamily: string;
  private target: NamePlateTarget;
  private offsetY: number;
  private nameText?: Phaser.GameObjects.Text;
  private statusEffects?: StatusEffectSource;
  private health?: HealthSource;
  private healthBarBg?: Phaser.GameObjects.Rectangle;
  private healthBarFill?: Phaser.GameObjects.Rectangle;
  private badgeTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private badgeBars: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private activeBadgeIds: string[] = [];

  constructor(scene: Phaser.Scene, fontFamily: string, target: NamePlateTarget, options: EntityLabelOptions = {}) {
    this.scene = scene;
    this.fontFamily = fontFamily;
    this.target = target;
    this.offsetY = options.offsetY ?? DEFAULT_OFFSET_Y;
    this.statusEffects = options.statusEffects;
    this.health = options.health;

    if (options.name) {
      this.nameText = scene.add
        .text(target.x, target.y - this.offsetY, options.name, {
          fontFamily,
          fontSize: options.fontSize ?? DEFAULT_FONT_SIZE,
          color: options.color ?? DEFAULT_COLOR,
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1);
    }

    if (this.health) {
      const barY = target.y - this.healthBarOffsetY();
      this.healthBarBg = scene.add
        .rectangle(target.x, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT, HP_BAR_BG_COLOR, HP_BAR_BG_ALPHA)
        .setOrigin(0.5, 0.5);
      this.healthBarFill = scene.add
        .rectangle(target.x - HP_BAR_WIDTH / 2, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT, HP_BAR_COLOR)
        .setOrigin(0, 0.5);
    }
  }

  private healthBarOffsetY(): number {
    return this.offsetY + (this.nameText ? NAME_TO_HP_GAP : 0);
  }

  private badgeRowOffsetY(): number {
    if (this.health) return this.healthBarOffsetY() + HP_TO_BADGE_GAP;
    if (this.nameText) return this.offsetY + BADGE_STACK_GAP;
    return this.offsetY;
  }

  private syncBadges() {
    if (!this.statusEffects) return;
    const currentIds = this.statusEffects.getActiveIds();
    const { added, removed } = diffBadgeIds(this.activeBadgeIds, currentIds);

    for (const id of removed) {
      this.badgeTexts.get(id)?.destroy();
      this.badgeTexts.delete(id);
      this.badgeBars.get(id)?.destroy();
      this.badgeBars.delete(id);
    }

    for (const id of added) {
      const def = STATUS_EFFECTS[id];
      if (!def) continue;
      const text = this.scene.add
        .text(this.target.x, this.target.y, def.label, {
          fontFamily: this.fontFamily,
          fontSize: BADGE_FONT_SIZE,
          color: def.color,
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0.5, 1);
      this.badgeTexts.set(id, text);

      const bar = this.scene.add
        .rectangle(this.target.x, this.target.y, BAR_WIDTH, BAR_HEIGHT, parseInt(def.color.replace("#", ""), 16))
        .setOrigin(0, 0.5);
      this.badgeBars.set(id, bar);
    }

    this.activeBadgeIds = currentIds;
  }

  private layoutBadges() {
    const baseY = this.target.y - this.badgeRowOffsetY();

    this.activeBadgeIds.forEach((id, i) => {
      const textY = baseY - i * BADGE_LINE_HEIGHT;
      const text = this.badgeTexts.get(id)!;
      text.setPosition(this.target.x, textY);

      const bar = this.badgeBars.get(id)!;
      const ratio = this.statusEffects?.getRemainingRatio(id) ?? 1;
      bar.setPosition(this.target.x - BAR_WIDTH / 2, textY + BAR_GAP + BAR_HEIGHT / 2);
      bar.width = BAR_WIDTH * ratio;
    });
  }

  setNameVisible(visible: boolean) {
    this.nameText?.setVisible(visible);
  }

  update() {
    if (this.nameText) {
      this.nameText.setPosition(this.target.x, this.target.y - this.offsetY);
    }

    if (this.health && this.healthBarBg && this.healthBarFill) {
      const barY = this.target.y - this.healthBarOffsetY();
      this.healthBarBg.setPosition(this.target.x, barY);
      this.healthBarFill.setPosition(this.target.x - HP_BAR_WIDTH / 2, barY);
      this.healthBarFill.width = HP_BAR_WIDTH * Math.max(0, Math.min(1, this.health.getRatio()));
    }

    this.syncBadges();
    this.layoutBadges();
  }

  destroy() {
    this.nameText?.destroy();
    this.healthBarBg?.destroy();
    this.healthBarFill?.destroy();
    this.badgeTexts.forEach((text) => text.destroy());
    this.badgeTexts.clear();
    this.badgeBars.forEach((bar) => bar.destroy());
    this.badgeBars.clear();
  }
}
