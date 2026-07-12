export interface AssetSelection {
  type: string;
  url: string;
}

export interface GameConfig {
  length_of_day: number; // 1 - 10
  theme_song: string;
  player_sprite: string;
  player_speed: number;
  collectible_type: string;
  enemy_type: string;
  mood: string;
  game_rules: string[];
  bosses: string[];
  spawn_rate: number; // * would difficulty be better? ms between spawns, at level 1
  enemy_color: string; // * necessarry if we have mood based colour masks?
  win_score: number;  // * win condition could be done in game_rules
  levels: number; // * not sure for now
  theme_name: string; // * necessarry?
  theme_id: string; // * necessarry?
  weapon: string; // * unless we store a player's weapon persistently in the database
  background_color: string; // * mood based backgrounds currently used
  asset_urls?: AssetSelection[];
}
