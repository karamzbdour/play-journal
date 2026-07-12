import Dungeon from "@mikewesthad/dungeon";

// Shared alias so every dungeon module refers to the same room type instead of each redeclaring
// `Dungeon["rooms"][number]` locally.
export type DungeonRoom = Dungeon["rooms"][number];
