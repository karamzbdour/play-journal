# Open-Book Journal Frontend — Design

**Date:** 2026-07-11
**Status:** Approved approach A (CSS 3D book), localStorage persistence, replayable pages.

## Goal

Replace the dashboard-style home page with an immersive open tome, themed to the
pixel-art roguelite (Phaser dungeon crawler, Silkscreen font, buch tileset). The
user flicks through past memories as book spreads and writes today's memory on
the final blank page. Generating a game saves the memory permanently; any past
page can be "relived" (replayed) via its saved `GameConfig`.

## Decisions

- **Persistence:** `localStorage` (key `play-journal-memories`). No backend changes.
- **Replayability:** each memory stores its generated `GameConfig`; a "Relive this
  memory" action loads it via the existing `saveGameConfig()` handoff to `/play`.
- **Rendering:** hand-rolled CSS 3D page flip (no new flip dependency). Parchment
  pages with pixel-dungeon chrome: Silkscreen for headings/buttons/stats, a
  handwriting font (Caveat via `next/font`) for memory text — paragraphs of
  Silkscreen are illegible.

## Data model (`src/lib/journal.ts`)

```ts
interface MemoryEntry {
  id: string;        // crypto.randomUUID()
  date: string;      // ISO timestamp at save time
  text: string;      // the journal text as written
  config: GameConfig; // the generated game config, for replay
}
```

Functions: `loadMemories(): MemoryEntry[]` (oldest first), `saveMemory(text, config): MemoryEntry`.
Corrupt/missing storage degrades to an empty book.

## Book structure

The book is a sequence of **spreads** (two facing pages):

- One spread per saved memory:
  - **Left page — run card:** date, theme name, mood, dungeon stats derived from
    the config (depth from `length_of_day`, foe, bosses, weapon), accent colors
    from `getPalette(theme_id)`, and the "Relive this memory" button.
  - **Right page — the memory:** the written text in handwriting font, with page
    number.
- Final spread — **today's page:**
  - Left page: scribe's lore/intro text (doubles as onboarding for an empty book).
  - Right page: ruled-parchment textarea, "Relive this day" (generate) button,
    the mock-preview escape hatch, and error text rendered as red ink.

The book opens on the writing spread. Navigation: chevron buttons at the page
corners and Left/Right arrow keys. Input is disabled mid-flip.

## Page-flip mechanics

State: `spreadIndex` + optional `flip: { dir, from, to }`. During a flip a
"leaf" (absolute-positioned right-page-sized element, `transform-origin: left
center` at the spine, `preserve-3d`, two `backface-visibility: hidden` faces)
animates `rotateY` 0 → −180° (next) or −180° → 0 (prev, ~600ms), while the
static pages beneath show the revealed spread:

- **next:** static left = current.left, static right = next.right; leaf front =
  current.right, leaf back = next.left.
- **prev:** static left = prev.left, static right = current.right; leaf front =
  prev.right, leaf back = current.left.

Commit `spreadIndex` and drop the leaf on animation end.

## Scene styling

Full-viewport dungeon backdrop: near-black slate, radial vignette, faint animated
torch-glow — echoing the game's vignette/mood effects. The tome sits centered
with stacked page-edge layers for thickness and a dark leather cover border.
Title chrome ("Play-Journal") in Silkscreen above the book. Parchment is CSS
only (layered gradients + SVG turbulence noise data-URI).

## Flow changes

- Generate: same `POST /api/generate-game`; on success `saveMemory(text, config)`
  + existing `saveGameConfig(config)` + `router.push("/play")`. On return, the
  memory is a filled spread.
- Mock preview: unchanged behaviour (does **not** save a memory — it's a test rig).
- `/play` page: untouched.

## Components

- `src/components/book/Book.tsx` — shell, flip state machine, keyboard nav.
- `src/components/book/MemorySpread.tsx` — run card + memory text pages.
- `src/components/book/TodaySpread.tsx` — lore page + writing page (owns textarea
  state via props from `page.tsx`, which keeps the API call logic).
- `src/app/page.tsx` — scene backdrop, loads memories, generate handler.
- `src/lib/journal.ts` — persistence.
- Fonts: add Caveat to `src/lib/fonts.ts`, register in `layout.tsx`.
- Book CSS lives in `globals.css` (3D transforms, parchment, leaf animation).

## Error handling

- Backend unreachable: red-ink error on the writing page; nothing saved.
- localStorage full/unavailable: game still launches (config handoff uses
  sessionStorage via existing `gameSession.ts`); memory save failure is logged,
  non-fatal.

## Testing

No test infra exists in the frontend. Verification: `npm run build` (type +
lint), then manual run — write an entry, generate (mock path), return home,
confirm the page persisted and flips/relives correctly.
