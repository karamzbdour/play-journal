// Special room types the dungeon can assign beyond plain rooms. Extend this union to add new
// kinds - then register a matching RoomSpawnStrategy with EnemySpawner and give it a quota in
// assignRoomKinds' callers.
export type RoomKind = "boss" | "swarm";
