---
name: verify
description: Build, launch, and drive the Play-Journal frontend to verify UI/game changes end-to-end
---

# Verifying the Play-Journal frontend

## Launch

```bash
cd frontend
npm run dev -- --port 3719   # run in background; ready when GET / returns 200
```

## Drive (Playwright)

`playwright` is already in frontend dependencies and Chromium is typically
installed at `%LOCALAPPDATA%\ms-playwright`. Run scripts with cwd =
`frontend/` and require playwright via
`require(path.join(process.cwd(), "node_modules", "playwright"))` if the
script lives outside the repo.

Bypass auth (client-side check only) with an init script:

```js
await page.addInitScript(() => {
  localStorage.setItem("play_journal_auth_token", "fake-token-for-ui-testing");
  localStorage.setItem("play_journal_user",
    JSON.stringify({ full_name: "Toby", email: "toby@example.com" }));
});
```

## Flows worth driving

- `/` — the journal book; "Practice run (mock data)" starts a game with no
  backend (uses `mockGameConfig`), "Relive this day" needs the FastAPI
  backend at :8000.
- `/play` — Phaser dungeon; wait for `canvas` plus ~1.5s for the scene to
  render before screenshotting. Player is the yellow dot.

## Gotchas

- The backend WebSocket (`ws://localhost:8000/ws/live-feed`) logs console
  errors when the backend is down/unauthed — pre-existing, not a finding.
- `.tome-scene` is `position: fixed` → it's a stacking context; overlays
  meant to cover the NavBar (z-50) must be rendered outside it.
- Pre-existing failures (not caused by your change): `tsc --noEmit` errors
  in `src/app/journal/page.tsx`; `npm run lint` reports ~20 problems.
