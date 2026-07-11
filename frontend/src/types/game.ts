export interface Achievement {
  id: string;
  title: string;
  description: string;
  points: number;
}

export interface GameConfig {
  theme_id: string;
  theme_name: string;
  background_color: string;
  player_sprite: string;
  player_speed: number;
  collectible_type: string;
  enemy_type: string;
  enemy_color: string;
  spawn_rate: number; // ms between spawns, at level 1
  win_score: number;
  mood: string;
  game_rules: string[];
  levels: number;
  bosses: string[];
  weapon: string;
  theme_song: string;
  achievements: Achievement[];
}
