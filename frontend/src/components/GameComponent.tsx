"use client";

import React, { useEffect, useRef } from "react";
import { GameConfig } from "@/types/game";
import { getPalette } from "@/lib/theme";

interface GameComponentProps {
  config: GameConfig;
  onScoreUpdate: (score: number) => void;
  onGameWin: () => void;
  onLevelUpdate?: (level: number, totalLevels: number) => void;
}

export default function GameComponent({ config, onScoreUpdate, onGameWin, onLevelUpdate }: GameComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let isDestroyed = false;
    const palette = getPalette(config.theme_id);
    const bossName = config.bosses[0] ?? "The Boss";
    const BOSS_MAX_HP = 3;
    const ATTACK_COOLDOWN = 500;
    const ATTACK_RADIUS = 90;
    const BOSS_CONTACT_COOLDOWN = 700;

    // Dynamically import Phaser to prevent SSR issues in Next.js
    import("phaser").then((Phaser) => {
      if (isDestroyed) return;

      class PlayScene extends Phaser.Scene {
        private player!: Phaser.GameObjects.Arc;
        private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
        private keys!: {
          W: Phaser.Input.Keyboard.Key;
          A: Phaser.Input.Keyboard.Key;
          S: Phaser.Input.Keyboard.Key;
          D: Phaser.Input.Keyboard.Key;
        };
        private attackKey!: Phaser.Input.Keyboard.Key;
        private collectibles!: Phaser.Physics.Arcade.Group;
        private enemies!: Phaser.Physics.Arcade.Group;
        private bossGroup!: Phaser.Physics.Arcade.Group;

        private score = 0;
        private levelScore = 0;
        private currentLevel = 1;
        private totalLevels = Math.max(1, config.levels || 1);
        private scorePerLevel = Math.ceil(config.win_score / this.totalLevels);

        private isBossPhase = false;
        private boss: Phaser.GameObjects.Container | null = null;
        private bossHp = BOSS_MAX_HP;
        private lastBossContact = 0;
        private lastAttack = 0;

        private isGameOver = false;
        private spawnTimer!: Phaser.Time.TimerEvent;

        private scoreText!: Phaser.GameObjects.Text;
        private levelText!: Phaser.GameObjects.Text;
        private bossText!: Phaser.GameObjects.Text;
        private instructionsText!: Phaser.GameObjects.Text;
        private winText!: Phaser.GameObjects.Text;
        private bannerText!: Phaser.GameObjects.Text;

        constructor() {
          super("PlayScene");
        }

        create() {
          const width = this.scale.width;
          const height = this.scale.height;

          this.score = 0;
          this.levelScore = 0;
          this.currentLevel = 1;
          this.isBossPhase = false;
          this.boss = null;
          this.bossHp = BOSS_MAX_HP;
          this.isGameOver = false;

          const playerColorNum = parseInt(palette.playerColor.replace("#", "0x"), 16);
          this.player = this.add.circle(width / 2, height - 80, 20, playerColorNum);
          this.physics.add.existing(this.player);
          (this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);

          if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.keys = this.input.keyboard.addKeys("W,A,S,D") as any;
            this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
          }

          this.collectibles = this.physics.add.group();
          this.enemies = this.physics.add.group();
          this.bossGroup = this.physics.add.group();

          this.spawnCollectible();
          this.spawnTimer = this.time.addEvent({
            delay: this.spawnRateForLevel(this.currentLevel),
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true,
          });

          this.physics.add.overlap(this.player, this.collectibles, this.handleCollect as any, undefined, this);
          this.physics.add.overlap(this.player, this.enemies, this.handleHitEnemy as any, undefined, this);
          this.physics.add.overlap(this.player, this.bossGroup, this.handleBossContact as any, undefined, this);

          this.scoreText = this.add
            .text(20, 20, `Score: 0 / ${config.win_score}`, {
              fontSize: "20px",
              fontFamily: "Courier, monospace",
              color: "#ffffff",
              fontStyle: "bold",
            })
            .setShadow(1, 1, "#000000", 2, true, true);

          this.levelText = this.add
            .text(20, 46, `Level 1 / ${this.totalLevels}`, {
              fontSize: "13px",
              fontFamily: "Courier, monospace",
              color: "#94a3b8",
            })
            .setShadow(1, 1, "#000000", 1, true, true);

          this.add
            .text(width - 20, 20, config.theme_name, {
              fontSize: "14px",
              fontFamily: "sans-serif",
              color: palette.playerColor,
              fontStyle: "bold",
            })
            .setOrigin(1, 0)
            .setShadow(1, 1, "#000000", 1, true, true);

          this.add
            .text(width - 20, 40, `♪ ${config.theme_song}`, {
              fontSize: "11px",
              fontFamily: "sans-serif",
              color: "#64748b",
            })
            .setOrigin(1, 0);

          this.add
            .text(20, height - 24, `Weapon: ${config.weapon}  [SPACE to attack]`, {
              fontSize: "12px",
              fontFamily: "sans-serif",
              color: "#94a3b8",
            })
            .setShadow(1, 1, "#000000", 1, true, true);

          this.bossText = this.add
            .text(width / 2, 20, "", {
              fontSize: "16px",
              fontFamily: "sans-serif",
              color: palette.bossColor,
              fontStyle: "bold",
            })
            .setOrigin(0.5, 0)
            .setVisible(false);

          this.instructionsText = this.add
            .text(width / 2, height / 2 - 40, "Move with ARROWS/WASD • SPACE to attack", {
              fontSize: "16px",
              fontFamily: "sans-serif",
              color: "#94a3b8",
            })
            .setOrigin(0.5);

          this.time.delayedCall(3000, () => {
            if (this.instructionsText.active) {
              this.tweens.add({ targets: this.instructionsText, alpha: 0, duration: 500 });
            }
          });

          this.bannerText = this.add
            .text(width / 2, height / 2 - 80, "", {
              fontSize: "28px",
              fontFamily: "sans-serif",
              color: "#facc15",
              fontStyle: "bold",
            })
            .setOrigin(0.5)
            .setVisible(false)
            .setShadow(2, 2, "#000000", 4, true, true);

          this.winText = this.add
            .text(width / 2, height / 2, "GOAL REACHED!\nBuild Deployed 🚀", {
              fontSize: "32px",
              fontFamily: "sans-serif",
              color: "#10b981",
              fontStyle: "bold",
              align: "center",
            })
            .setOrigin(0.5)
            .setVisible(false)
            .setShadow(2, 2, "#000000", 4, true, true);

          onLevelUpdate?.(this.currentLevel, this.totalLevels);
        }

        update() {
          if (this.isGameOver) return;

          const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
          if (!playerBody) return;

          if (this.cursors.left.isDown || this.keys.A.isDown) {
            playerBody.setVelocityX(-config.player_speed);
          } else if (this.cursors.right.isDown || this.keys.D.isDown) {
            playerBody.setVelocityX(config.player_speed);
          } else {
            playerBody.setVelocityX(0);
          }

          if (this.cursors.up.isDown || this.keys.W.isDown) {
            playerBody.setVelocityY(-config.player_speed);
          } else if (this.cursors.down.isDown || this.keys.S.isDown) {
            playerBody.setVelocityY(config.player_speed);
          } else {
            playerBody.setVelocityY(0);
          }

          if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
            this.performAttack();
          }
        }

        private spawnRateForLevel(level: number) {
          return Math.max(300, config.spawn_rate - (level - 1) * 250);
        }

        private performAttack() {
          const now = this.time.now;
          if (now - this.lastAttack < ATTACK_COOLDOWN) return;
          this.lastAttack = now;

          const ring = this.add.circle(this.player.x, this.player.y, 6, 0xffffff, 0.5);
          ring.setStrokeStyle(2, 0xffffff, 0.8);
          this.tweens.add({
            targets: ring,
            radius: ATTACK_RADIUS,
            alpha: 0,
            duration: 250,
            onComplete: () => ring.destroy(),
          });

          this.enemies.getChildren().forEach((enemy) => {
            const e = enemy as Phaser.GameObjects.Container;
            if (!e.active) return;
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
            if (dist <= ATTACK_RADIUS) {
              e.destroy();
            }
          });

          if (this.boss && this.boss.active) {
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
            if (dist <= ATTACK_RADIUS) {
              this.damageBoss();
            }
          }
        }

        private spawnCollectible() {
          if (this.isGameOver || this.isBossPhase) return;

          const width = this.scale.width;
          const height = this.scale.height;
          const x = Phaser.Math.Between(40, width - 40);
          const y = Phaser.Math.Between(100, height - 100);
          const colorNum = parseInt(palette.collectibleColor.replace("#", "0x"), 16);

          const graphics = this.add.graphics();
          graphics.fillStyle(colorNum, 1);
          graphics.beginPath();
          graphics.moveTo(0, -12);
          graphics.lineTo(12, 0);
          graphics.lineTo(0, 12);
          graphics.lineTo(-12, 0);
          graphics.closePath();
          graphics.fill();

          const container = this.add.container(x, y, [graphics]);
          container.setSize(24, 24);
          this.collectibles.add(container);
          (container.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);

          this.tweens.add({
            targets: container,
            y: y - 10,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }

        private spawnEnemy() {
          if (this.isGameOver) return;

          const width = this.scale.width;
          const x = Phaser.Math.Between(40, width - 40);
          const colorNum = parseInt(config.enemy_color.replace("#", "0x"), 16);

          const graphics = this.add.graphics();
          graphics.fillStyle(colorNum, 1);
          graphics.beginPath();
          graphics.moveTo(0, -12);
          graphics.lineTo(12, 12);
          graphics.lineTo(-12, 12);
          graphics.closePath();
          graphics.fill();

          const container = this.add.container(x, -20, [graphics]);
          container.setSize(24, 24);
          this.enemies.add(container);

          const body = container.body as Phaser.Physics.Arcade.Body;
          body.setVelocityY(Phaser.Math.Between(150, 300 + this.currentLevel * 20));

          this.tweens.add({
            targets: container,
            angle: 360,
            duration: Phaser.Math.Between(2000, 4000),
            repeat: -1,
          });

          this.time.addEvent({
            delay: 5000,
            callback: () => {
              if (container.active) container.destroy();
            },
          });
        }

        private handleCollect(_player: any, collectible: Phaser.GameObjects.Container) {
          collectible.destroy();

          const flash = this.add.circle(collectible.x, collectible.y, 10, 0xffffff);
          this.tweens.add({
            targets: flash,
            scale: 2,
            alpha: 0,
            duration: 200,
            onComplete: () => flash.destroy(),
          });

          this.score += 1;
          this.levelScore += 1;
          this.scoreText.setText(`Score: ${this.score} / ${config.win_score}`);
          onScoreUpdate(this.score);

          if (this.isBossPhase) return;

          if (this.levelScore >= this.scorePerLevel) {
            if (this.currentLevel < this.totalLevels) {
              this.advanceLevel();
            } else {
              this.startBossPhase();
            }
          } else {
            this.spawnCollectible();
          }
        }

        private advanceLevel() {
          this.currentLevel += 1;
          this.levelScore = 0;
          this.levelText.setText(`Level ${this.currentLevel} / ${this.totalLevels}`);
          onLevelUpdate?.(this.currentLevel, this.totalLevels);

          this.spawnTimer.remove(false);
          this.spawnTimer = this.time.addEvent({
            delay: this.spawnRateForLevel(this.currentLevel),
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true,
          });

          this.showBanner(`LEVEL ${this.currentLevel}`);
          this.spawnCollectible();
        }

        private showBanner(message: string) {
          this.bannerText.setText(message).setVisible(true).setAlpha(1).setScale(0.5);
          this.tweens.add({
            targets: this.bannerText,
            scale: 1,
            duration: 300,
            ease: "Back.easeOut",
          });
          this.time.delayedCall(1200, () => {
            this.tweens.add({
              targets: this.bannerText,
              alpha: 0,
              duration: 400,
              onComplete: () => this.bannerText.setVisible(false),
            });
          });
        }

        private startBossPhase() {
          this.isBossPhase = true;
          this.collectibles.clear(true, true);
          this.showBanner("BOSS INCOMING");

          const width = this.scale.width;
          const colorNum = parseInt(palette.bossColor.replace("#", "0x"), 16);

          const graphics = this.add.graphics();
          graphics.fillStyle(colorNum, 1);
          graphics.fillCircle(0, 0, 26);
          graphics.lineStyle(3, 0xffffff, 0.6);
          graphics.strokeCircle(0, 0, 26);

          const container = this.add.container(width / 2, 100, [graphics]);
          container.setSize(52, 52);
          this.bossGroup.add(container);
          this.boss = container;
          this.bossHp = BOSS_MAX_HP;

          const body = container.body as Phaser.Physics.Arcade.Body;
          body.setImmovable(true);
          body.setCollideWorldBounds(true);

          this.tweens.add({
            targets: container,
            x: width - 60,
            duration: 1800,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });

          this.bossText.setText(`${bossName}  HP: ${this.bossHp}`).setVisible(true);
        }

        private damageBoss() {
          if (!this.boss) return;
          this.bossHp -= 1;

          this.cameras.main.flash(80, 255, 255, 255, true);
          this.bossText.setText(`${bossName}  HP: ${Math.max(0, this.bossHp)}`);

          if (this.bossHp <= 0) {
            this.boss.destroy();
            this.boss = null;
            this.handleWin();
          }
        }

        private handleBossContact(_player: any) {
          const now = this.time.now;
          if (now - this.lastBossContact < BOSS_CONTACT_COOLDOWN) return;
          this.lastBossContact = now;

          this.cameras.main.flash(150, 239, 68, 68, true);
          this.score = Math.max(0, this.score - 1);
          this.scoreText.setText(`Score: ${this.score} / ${config.win_score}`);
          onScoreUpdate(this.score);
        }

        private handleHitEnemy(_player: any, enemy: Phaser.GameObjects.Container) {
          enemy.destroy();
          this.cameras.main.flash(150, 239, 68, 68, true);
          this.score = Math.max(0, this.score - 1);
          this.scoreText.setText(`Score: ${this.score} / ${config.win_score}`);
          onScoreUpdate(this.score);
        }

        private handleWin() {
          this.isGameOver = true;
          this.spawnTimer.remove(false);
          this.collectibles.clear(true, true);
          this.enemies.clear(true, true);

          const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
          if (playerBody) playerBody.setVelocity(0, 0);

          if (this.isBossPhase) {
            this.winText.setText(`${bossName} DEFEATED!\nBuild Deployed 🚀`);
          }

          this.winText.setVisible(true);
          this.winText.setScale(0.5);
          this.tweens.add({ targets: this.winText, scale: 1, duration: 500, ease: "Back.easeOut" });

          onGameWin();
        }
      }

      const gameConfig: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: "100%",
        height: 400,
        parent: containerRef.current,
        backgroundColor: config.background_color,
        physics: {
          default: "arcade",
          arcade: { gravity: { x: 0, y: 0 }, debug: false },
        },
        scene: PlayScene,
      };

      const game = new Phaser.Game(gameConfig);
      gameRef.current = game;

      const handleResize = () => {
        if (game && !isDestroyed) {
          game.scale.resize(containerRef.current?.clientWidth || 800, 400);
        }
      };

      window.addEventListener("resize", handleResize);

      return () => {
        isDestroyed = true;
        window.removeEventListener("resize", handleResize);
        if (gameRef.current) {
          gameRef.current.destroy(true);
          gameRef.current = null;
        }
      };
    });

    return () => {
      isDestroyed = true;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [config, onScoreUpdate, onGameWin, onLevelUpdate]);

  const palette = getPalette(config.theme_id);

  return (
    <div className="w-full relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl border-2 transition-colors duration-500"
        style={{ borderColor: palette.playerColor + "22" }}
      />
      <div ref={containerRef} className="w-full h-[400px] block" />
    </div>
  );
}
