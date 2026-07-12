// Minimal surface of Phaser.Tilemaps.TilemapLayer that Door needs, so it can be unit tested
// without spinning up a real Phaser tilemap.
export interface DoorTileLayer {
  putTileAt(index: number, tileX: number, tileY: number): unknown;
  removeTileAt(tileX: number, tileY: number): unknown;
}

// A single doorway tile on a tilemap layer that can be sealed shut (colliding, closedTileIndex
// drawn over it) or opened back up (tile removed, whatever was underneath shows through again).
export default class Door {
  private opened = true;

  constructor(
    private readonly layer: DoorTileLayer,
    private readonly tileX: number,
    private readonly tileY: number,
    private readonly closedTileIndex: number
  ) {}

  get isOpen(): boolean {
    return this.opened;
  }

  open(): void {
    if (this.opened) return;
    this.opened = true;
    this.layer.removeTileAt(this.tileX, this.tileY);
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.layer.putTileAt(this.closedTileIndex, this.tileX, this.tileY);
  }
}
