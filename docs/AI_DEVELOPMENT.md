# Working on Play-Journal with an AI

## The shape of the code

The backend turns a journal entry into a `GameConfig` JSON (`frontend/src/types/game.ts`, mirrored in `backend/main.py` — change both together). The frontend spends it: `app/` pages hand it to `game/scenes/DungeonScene.ts`, which wires together small, independent modules:

- `game/combat/` — the systems: attacks, cooldowns, health, status effects, line-of-sight
- `game/entities/` — Player/Enemy; both implement `CombatEntity`
- `game/ui/`, `game/effects/` — nameplates, mood tints, rain
- `game/settings.ts` — the in-game settings store (React menu ↔ Phaser, live)
- `tests/` mirrors `src/` (vitest)

## The core design idea

**Content is data, not code.** A weapon attack is a list of `AttackComponent`s (damage, status) resolved by one function; status effects are entries in `STATUS_EFFECTS`. A new weapon tomorrow should be a new data entry that mixes existing effects — only invent a new component kind when no combination works. The priority is securing the gameplay loop: generate weapons/enemies from the prompt's JSON and place them. Adding genuinely useful fields to the JSON is encouraged.

## Roadmap

- **UX:** game-over screen, waking-up animation, themed settings screen, sound settings, theme songs per mood, SFX, HUD for weapon abilities, clean the `*`-commented JSON fields out
- **Gameplay:** difficulty slider scaling enemies, ranged attacks/projectiles, weapon abilities (check existing progress first)
- **Misc:** populate the DB with consistent, well-named sprites and SFX so the LLM can pick them
