export interface GameConfig {
  theme_id: string; // necessarry?
  theme_name: string; // necessarry?
  background_color: string; // * mood based backgrounds currently used
  player_sprite: string;
  player_speed: number;
  collectible_type: string;
  enemy_type: string;
  enemy_color: string; // * necessarry if we have mood based colour masks?
  spawn_rate: number; // ms between spawns, at level 1
  win_score: number;  // * win condition could be done in game_rules
  mood: string;
  game_rules: string[];
  levels: number; // * not sure for now
  bosses: string[];
  weapon: string;
  theme_song: string;
  length_of_day: number; // 1 - 10
}
