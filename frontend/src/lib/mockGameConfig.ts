import { AssetSelection, GameConfig } from "@/types/game";

const MOCK_ASSET_URLS: AssetSelection[] = [
  { type: "enemy", url: "https://oiewexydmyhcbdejhgyf.supabase.co/storage/v1/object/public/sprites/enemy/1df50240-a879-498c-ac89-532874a57a0d.webp" },
  { type: "boss", url: "https://oiewexydmyhcbdejhgyf.supabase.co/storage/v1/object/public/sprites/boss/fa6db780-2fba-441b-8062-56540b6789bc.webp" },
];

export const mockGameConfig: GameConfig = {
  theme_id: "coder_coffee",
  theme_name: "Coder's Coffee Chase",
  background_color: "#0f172a",
  player_sprite: "sliced_knight",
  player_speed: 350,
  collectible_type: "coffee",
  enemy_type: "bug",
  enemy_color: "#ef4444",
  spawn_rate: 1200,
  win_score: 12,
  mood: "reflective",
  game_rules: [
    "Use ARROW keys or WASD to move.",
    "Catch coffee cups to score points and avoid the red bugs.",
    "Press SPACE to swing your keyboard weapon and destroy nearby bugs.",
    "Survive all levels and defeat the final boss to deploy your build!",
  ],
  levels: 3,
  bosses: ["The Merge Conflict", "Big John"],
  weapon: "mechanical_keyboard",
  theme_song: "lofi_deploy_beats.mp3",
  length_of_day: 8,
  asset_urls: MOCK_ASSET_URLS,
};
