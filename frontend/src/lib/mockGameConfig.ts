import { GameConfig } from "@/types/game";

export const mockGameConfig: GameConfig = {
  theme_id: "coder_coffee",
  theme_name: "Coder's Coffee Chase",
  background_color: "#0f172a",
  player_sprite: "programmer",
  player_speed: 350,
  collectible_type: "coffee",
  enemy_type: "bug",
  enemy_color: "#ef4444",
  spawn_rate: 1200,
  win_score: 12,
  mood: "productive",
  game_rules: [
    "Use ARROW keys or WASD to move.",
    "Catch coffee cups to score points and avoid the red bugs.",
    "Press SPACE to swing your keyboard weapon and destroy nearby bugs.",
    "Survive all levels and defeat the final boss to deploy your build!",
  ],
  levels: 3,
  bosses: ["The Merge Conflict"],
  weapon: "mechanical_keyboard",
  theme_song: "lofi_deploy_beats.mp3",
  length_of_day: 8,
};
