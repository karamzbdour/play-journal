"use client";

import React, { useEffect, useRef } from "react";

interface Achievement {
  id: string;
  title: string;
  description: string;
  points: number;
}

interface GameConfig {
  theme_id: string;
  theme_name: string;
  background_color: string;
  player_sprite: string;
  player_color: string;
  player_speed: number;
  collectible_type: string;
  collectible_color: string;
  enemy_type: string;
  enemy_color: string;
  spawn_rate: number;
  win_score: number;
  mood: string;
  game_rules: string;
  achievements: Achievement[];
}

interface GameComponentProps {
  config: GameConfig;
  onScoreUpdate: (score: number) => void;
  onGameWin: () => void;
}

export default function GameComponent({ config, onScoreUpdate, onGameWin }: GameComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let isDestroyed = false;

    // Dynamically import Phaser to prevent SSR issues in Next.js
    import("phaser").then((Phaser) => {
      if (isDestroyed) return;

      // Class representing our dynamic arcade scene
      class PlayScene extends Phaser.Scene {
        private player!: Phaser.GameObjects.Arc | Phaser.GameObjects.Rectangle;
        private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
        private keys!: {
          W: Phaser.Input.Keyboard.Key;
          A: Phaser.Input.Keyboard.Key;
          S: Phaser.Input.Keyboard.Key;
          D: Phaser.Input.Keyboard.Key;
        };
        private collectibles!: Phaser.Physics.Arcade.Group;
        private enemies!: Phaser.Physics.Arcade.Group;
        private score: number = 0;
        private scoreText!: Phaser.GameObjects.Text;
        private instructionsText!: Phaser.GameObjects.Text;
        private winText!: Phaser.GameObjects.Text;
        private isGameOver: boolean = false;
        private spawnTimer!: Phaser.Time.TimerEvent;

        constructor() {
          super("PlayScene");
        }

        create() {
          const width = this.scale.width;
          const height = this.scale.height;

          // 1. Reset state
          this.score = 0;
          this.isGameOver = false;

          // 2. Add player (represented by a smooth colored circle with outline)
          const playerColorNum = parseInt(config.player_color.replace("#", "0x"), 16);
          
          // Create physics-enabled player
          this.player = this.add.circle(width / 2, height - 80, 20, playerColorNum);
          this.physics.add.existing(this.player);
          
          // Set player physics bounds
          const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
          playerBody.setCollideWorldBounds(true);

          // 3. Setup Controls (Keyboard)
          if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.keys = this.input.keyboard.addKeys("W,A,S,D") as any;
          }

          // 4. Setup Collectibles Group
          this.collectibles = this.physics.add.group();
          
          // 5. Setup Enemies Group
          this.enemies = this.physics.add.group();

          // 6. Spawn initial collectible
          this.spawnCollectible();

          // 7. Timer for spawning enemies
          this.spawnTimer = this.time.addEvent({
            delay: config.spawn_rate,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
          });

          // 8. Setup Collisions
          this.physics.add.overlap(
            this.player,
            this.collectibles,
            this.handleCollect as any,
            undefined,
            this
          );

          this.physics.add.overlap(
            this.player,
            this.enemies,
            this.handleHitEnemy as any,
            undefined,
            this
          );

          // 9. Score UI text (glowing digital text)
          this.scoreText = this.add.text(20, 20, `Score: 0 / ${config.win_score}`, {
            fontSize: "20px",
            fontFamily: "Courier, monospace",
            color: "#ffffff",
            fontStyle: "bold"
          }).setShadow(1, 1, "#000000", 2, true, true);

          // 10. Header theme title
          this.add.text(width - 20, 20, config.theme_name, {
            fontSize: "14px",
            fontFamily: "sans-serif",
            color: config.player_color,
            fontStyle: "bold"
          }).setOrigin(1, 0).setShadow(1, 1, "#000000", 1, true, true);

          // 11. Instructions text shown briefly at start
          this.instructionsText = this.add.text(width / 2, height / 2 - 40, "Use ARROWS or WASD to move", {
            fontSize: "16px",
            fontFamily: "sans-serif",
            color: "#94a3b8"
          }).setOrigin(0.5);

          // Fade out instructions after 3 seconds
          this.time.delayedCall(3000, () => {
            if (this.instructionsText.active) {
              this.tweens.add({
                targets: this.instructionsText,
                alpha: 0,
                duration: 500
              });
            }
          });

          // 12. Complete/Win text placeholder
          this.winText = this.add.text(width / 2, height / 2, "GOAL REACHED!\nBuild Deployed 🚀", {
            fontSize: "32px",
            fontFamily: "sans-serif",
            color: "#10b981",
            fontStyle: "bold",
            align: "center"
          }).setOrigin(0.5).setVisible(false).setShadow(2, 2, "#000000", 4, true, true);
        }

        update() {
          if (this.isGameOver) return;

          const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
          if (!playerBody) return;

          // Horizontal movement
          if (this.cursors.left.isDown || this.keys.A.isDown) {
            playerBody.setVelocityX(-config.player_speed);
          } else if (this.cursors.right.isDown || this.keys.D.isDown) {
            playerBody.setVelocityX(config.player_speed);
          } else {
            playerBody.setVelocityX(0);
          }

          // Vertical movement
          if (this.cursors.up.isDown || this.keys.W.isDown) {
            playerBody.setVelocityY(-config.player_speed);
          } else if (this.cursors.down.isDown || this.keys.S.isDown) {
            playerBody.setVelocityY(config.player_speed);
          } else {
            playerBody.setVelocityY(0);
          }
        }

        private spawnCollectible() {
          if (this.isGameOver) return;

          const width = this.scale.width;
          const height = this.scale.height;

          const x = Phaser.Math.Between(40, width - 40);
          const y = Phaser.Math.Between(100, height - 100);

          const colorNum = parseInt(config.collectible_color.replace("#", "0x"), 16);
          
          // Draw collectible shape (a neat diamond)
          const graphics = this.add.graphics();
          graphics.fillStyle(colorNum, 1);
          // Draw diamond centered at 0,0 for physics rotation
          graphics.beginPath();
          graphics.moveTo(0, -12);
          graphics.lineTo(12, 0);
          graphics.lineTo(0, 12);
          graphics.lineTo(-12, 0);
          graphics.closePath();
          graphics.fill();

          // Create container containing graphics for physics
          const container = this.add.container(x, y, [graphics]);
          container.setSize(24, 24);
          this.collectibles.add(container);

          const body = container.body as Phaser.Physics.Arcade.Body;
          body.setCollideWorldBounds(true);

          // Add a subtle hovering tween
          this.tweens.add({
            targets: container,
            y: y - 10,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
          });
        }

        private spawnEnemy() {
          if (this.isGameOver) return;

          const width = this.scale.width;
          const x = Phaser.Math.Between(40, width - 40);
          
          const colorNum = parseInt(config.enemy_color.replace("#", "0x"), 16);

          // Draw hazard shape (an exclamation triangle or falling square)
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
          // Set downward speed (gravity)
          body.setVelocityY(Phaser.Math.Between(150, 300));
          
          // Rotate hazard as it falls
          this.tweens.add({
            targets: container,
            angle: 360,
            duration: Phaser.Math.Between(2000, 4000),
            repeat: -1
          });

          // Clean up if it falls off screen
          this.time.addEvent({
            delay: 5000,
            callback: () => {
              if (container.active) container.destroy();
            }
          });
        }

        private handleCollect(player: any, collectible: Phaser.GameObjects.Container) {
          collectible.destroy();
          
          // Visual pop effect
          const flash = this.add.circle(collectible.x, collectible.y, 10, 0xffffff);
          this.tweens.add({
            targets: flash,
            scale: 2,
            alpha: 0,
            duration: 200,
            onComplete: () => flash.destroy()
          });

          // Increment Score
          this.score += 1;
          this.scoreText.setText(`Score: ${this.score} / ${config.win_score}`);
          onScoreUpdate(this.score);

          // Check Win Condition
          if (this.score >= config.win_score) {
            this.handleWin();
          } else {
            // Spawn next target
            this.spawnCollectible();
          }
        }

        private handleHitEnemy(player: any, enemy: Phaser.GameObjects.Container) {
          enemy.destroy();
          
          // Visual red camera flash effect
          this.cameras.main.flash(150, 239, 68, 68, true);

          // Deduct score (but don't go below 0)
          this.score = Math.max(0, this.score - 1);
          this.scoreText.setText(`Score: ${this.score} / ${config.win_score}`);
          onScoreUpdate(this.score);
        }

        private handleWin() {
          this.isGameOver = true;
          this.spawnTimer.destroy();
          
          // Clear remaining objects
          this.collectibles.clear(true, true);
          this.enemies.clear(true, true);

          // Stop player physics
          const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
          if (playerBody) playerBody.setVelocity(0, 0);

          // Display Win Banner
          this.winText.setVisible(true);
          this.winText.setScale(0.5);
          this.tweens.add({
            targets: this.winText,
            scale: 1,
            duration: 500,
            ease: "Back.easeOut"
          });

          // Trigger win callback in parent component
          onGameWin();
        }
      }

      // Phaser game configuration
      const gameConfig: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: "100%",
        height: 400,
        parent: containerRef.current,
        backgroundColor: config.background_color,
        physics: {
          default: "arcade",
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
          }
        },
        scene: PlayScene
      };

      // Initialize game
      const game = new Phaser.Game(gameConfig);
      gameRef.current = game;

      // Handle window resizing
      const handleResize = () => {
        if (game && !isDestroyed) {
          game.scale.resize(containerRef.current?.clientWidth || 800, 400);
        }
      };

      window.addEventListener("resize", handleResize);

      // Clean up on unmount
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
  }, [config, onScoreUpdate, onGameWin]);

  return (
    <div className="w-full relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
      {/* Game frame border highlight using theme styling */}
      <div 
        className="absolute inset-0 pointer-events-none rounded-2xl border-2 transition-colors duration-500" 
        style={{ borderColor: config.player_color + "22" }}
      />
      <div ref={containerRef} className="w-full h-[400px] block" />
    </div>
  );
}
