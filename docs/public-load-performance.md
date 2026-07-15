# Public Load Performance

Last updated: 2026-07-04

## Original Problem

Opening `https://mars2050.vercel.app/` in a fresh browser can show the generic loading screen for several seconds before the public auth page appears.

This is separate from authenticated game/canvas loading. The public auth page was gated behind client-side auth initialization.

## Original Live Baseline

Measured before the public-shell fixes with Playwright in fresh browser contexts against production Vercel:

| Marker | Observed |
| --- | --- |
| HTML TTFB | 100-216 ms |
| DOMContentLoaded | under 1 s |
| Auth UI visible | 4.7-6.8 s |

Main observed cost before auth UI:

- Initial `_next/static/chunks/*.js` download/evaluation.
- Client hydration before the unauthenticated shell is rendered.
- Supabase connectivity probe performs a `/rest/v1/` request and receives `401`; this is noisy and should not be part of public first paint.

## Root Cause

`src/app/page.tsx` was a client component and rendered `Loading Mars2050...` while `useAuth()` initialized. For an unauthenticated visitor, the browser had to download and execute the startup JS bundle, initialize Supabase auth/session state, run effects, and only then render the public auth UI.

The public auth screen should be server/static HTML first. Auth/session resume should run after first paint and redirect into the game only when a real session is found.

## Shipped Changes

- `src/app/page.tsx` is now a server/static page.
- `PublicAuthShell` renders the public auth screen directly in HTML.
- `PublicAuthActions` lazy-loads `AuthModal` and Supabase auth only after login/register intent.
- `AuthRuntimeMount` lazy-loads the auth/game runtime after first paint.
- `GameShell` remains lazy and loads only after session + colony are known.
- `useAuth` and `useTelegramAuth` lazy-load the browser Supabase client only when session/login/TWA work actually needs it.
- The Supabase connectivity probe was removed from first load; public `/` no longer emits the `401 /rest/v1/` probe.
- `tests/e2e/public-load.spec.ts` verifies public auth HTML without JavaScript and no Supabase REST work before shell visibility.
- Authenticated refresh now tries `/api/auth/resume` from the existing auth cookie before importing Supabase JS.
- `/api/auth/resume` returns `{ user, colonyId }` for existing colonies without running first-load backfills on every refresh.
- Bootstrap uses cookie-first same-origin fetch when possible, avoiding a duplicate `supabase.auth.getSession()` before `/api/colonies/bootstrap`.
- Authenticated refresh uses a 30-minute display-only bootstrap cache to render the last colony snapshot before fresh bootstrap completes.
- Game-shell and canvas loading now use one resume flow: no second full-screen `Загрузка колонии...`; fresh sync is shown as a small HUD status.
- `/api/colonies/bootstrap` is now the fast first-render read path; expensive recalculation runs through deferred `/api/colonies/sync`.

## Session Resume Flash Guard

The first static-shell fix caused a short auth-page flash for already-authenticated users: the public auth HTML painted before the client runtime restored the session and mounted the game.

The current fix adds a pre-hydration guard:

- `PublicAuthBoot` runs a small inline script before the auth shell is parsed.
- The script checks `supabase-access-token` cookie and Supabase `localStorage` auth-token markers.
- If an auth marker exists, it adds `mars2050-auth-resume` to `<html>`.
- CSS hides the public auth shell and shows `AuthResumeShell` (`Загрузка колонии... / Восстанавливаем сессию`) before React hydrates.
- If the marker is stale and no session is found, `AuthRuntime` removes the guard and the public auth shell returns.

Regression coverage:

- `stored auth marker shows resume shell before app runtime hydrates`
- `stored auth marker hydrates without html class mismatch warning`
- The test blocks `_next/static/chunks/**` to verify the no-flash behavior before app runtime hydration.

## Current Live Result

After deployment:

| Scenario | Result |
| --- | --- |
| Fresh unauthenticated browser | Public auth shell visible at about 0.5-0.8 s in repeated live Playwright checks |
| Fresh unauthenticated browser | 0 API requests before public shell |
| Fresh unauthenticated browser | About 220 KB JS transfer and 15 KB CSS transfer before the shell settles |
| Auth marker present, app chunks blocked | Resume shell visible, public auth shell hidden |

## Integrated Load Contract

The current player-load contract is:

1. Static shell first: `/` renders public/resume auth HTML before app runtime work.
2. Single bootstrap payload: authenticated game entry starts with exactly one `/api/colonies/bootstrap`.
3. Route-level code splitting: public auth, auth runtime, game shell, HUD, canvas, overlays, and simulators stay in separate chunks.
4. Interaction-triggered overlays: command center, global management, battle replay, build catalog, and heavy tabs load only after UI intent.
5. Fallback-first canvas: Pixi draws grid/terrain/building fallbacks first, then replaces textures as assets arrive.
6. Performance e2e contract: Playwright enforces timings, API counts, JS transfer, milestones, console cleanliness, and canvas pixel checks.

Runtime load milestones use the `mars2050:load:*` performance mark prefix:

| Milestone | Meaning |
| --- | --- |
| `public-shell` | Static public auth shell reached first paint window |
| `auth-resume` | Pre-hydration auth marker guard selected resume shell |
| `bootstrap-start` / `bootstrap-end` | Authenticated game bootstrap request lifecycle |
| `cached-bootstrap-used` | A valid local bootstrap snapshot was used for first render |
| `first-canvas` | Pixi canvas and base fallback grid reached the first visible render |
| `game-shell-mounted` | Authenticated game shell mounted after auth resume |
| `fresh-bootstrap-end` | Fresh bootstrap request finished after cached or cold first render |
| `bootstrap-sync-start` / `bootstrap-sync-end` | Deferred full colony recalculation after first canvas |
| `late-assets-ready` | Remaining colony texture preload finished |
| `overlay-open` | User opened a lazy heavy overlay |
| `resume-overlay-hidden` | Static resume overlay was released after game resume |

## Authenticated Game Entry Budget

The next performance target is the already-authenticated path:

`AuthRuntime -> /api/auth/resume -> GameShell -> fallback canvas -> /api/colonies/bootstrap -> hydrated HUD data`

This is now covered by `tests/e2e/performance.desktop.spec.ts`.

Budgets:

| Marker | Budget |
| --- | --- |
| Public auth shell visible | <= 1500 ms |
| Desktop first canvas visible | <= 6000 ms |
| First game API payload | exactly 1 `/api/colonies/bootstrap` |
| Early duplicate APIs | 0 `/api/resources`, 0 `/api/events/process`, 0 `/api/buildings` before player action |
| Desktop first canvas JS chunks | <= 45 Next static JS chunk requests |
| Desktop first canvas JS transfer | baseline 1.6 MB, budget <= 1.84 MB (+15%) on the dev-server e2e path |
| Browser Supabase REST/Auth during e2e bypass | 0 requests |

When these budgets fail, treat the Playwright top-transfer output as the first triage source before changing gameplay code.

## Authenticated Refresh Fast Path

The refresh path must not wait for all gameplay recalculation before showing the game frame.

Current sequence for an existing web session:

1. `PublicAuthBoot` detects the auth cookie/localStorage marker and shows `AuthResumeShell`.
2. `useAuth` calls `/api/auth/resume` if the `supabase-access-token` cookie exists.
3. The resume endpoint validates the JWT via `getAuthContext()` and resolves an existing colony id with a lightweight `colonies.id` query.
4. `GameShell` mounts as soon as `user + colonyId` are known.
5. `ColonyCanvas` draws the fallback grid before bootstrap data and late textures finish.
6. `/api/colonies/bootstrap` hydrates colony/resources/buildings/population after the first game shell is mounted.
7. After `first-canvas`, `/api/colonies/sync` runs recalculation/events/work-orders and updates the displayed payload/cache.

Fallback behavior:

- If the cookie is missing or invalid, `useAuth` falls back to the normal Supabase `getSession()` path.
- If the user has no colony yet, `/api/auth/resume` falls back to full colony creation.
- TWA and mutation requests still use the Authorization-header path when cookies are unavailable.

## Unified Authenticated Refresh UX

Implemented v1 plan:

- Store the latest successful bootstrap payload in `localStorage` as `mars2050_bootstrap:${colonyId}` with `schemaVersion: 1` and a 30-minute TTL.
- Treat the cached payload as optimistic display state only. It never grants auth, ownership, or mutation rights.
- On authenticated reload, `useColonyBootstrap` returns cached colony/resources/buildings/population immediately and still requests fresh `/api/colonies/bootstrap`.
- Fresh bootstrap success refreshes the cache. Fresh `401/403` clears the cache for that colony.
- The lazy `GameShell` fallback is `null`; `AuthResumeShell` remains the only full-screen resume loading surface before the game mounts.
- Once the game shell is visible, stale/fresh bootstrap work is represented by the compact `Синхронизация...` HUD status.
- The Pixi canvas still uses fallback-first rendering when no cache exists.

Deferred out of this slice:

- No separate `/api/colonies/bootstrap-fast` URL; the existing bootstrap endpoint is the fast path.
- Further backend work can reduce sync cost, but it is no longer on the first-canvas path.

Verification for this slice:

- `npx tsc --noEmit --pretty false` passed.
- `npx tsx scripts/check-limits.ts --diff HEAD --json` passed.
- `npm test` passed: 430 tests.
- `npm run build` passed.
- `npm run test:e2e -- --reporter=line` passed: 12 tests.

## Simulator Routes

`/simulator` and `/simulator2` are static routes but historically loaded heavier than `/`. A live `/simulator2` check before the route split showed about 304 KB JS transfer, 18 JS files, and a 36 s first-screen delay on a slow production request because replay/Pixi/combat chunks were part of the first screen graph.

`/simulator2` now follows the same intent-driven rule as gameplay overlays:

- The first screen renders only the simulator shell, unit selectors, and grid.
- Battle replay code loads through `LazyBattleReplayModal` only after simulation data exists; `/simulator2` defaults to the Pixi replay engine, with Canvas still selectable as fallback and baseline renderer.
- The deterministic combat engine imports only when the player starts a simulation.
- Preset data imports only after a preset is selected.
- Hidden unit tooltip DOM was removed from the prerendered shell; compact button `title` text keeps unit stats available without duplicating large hidden markup.
- `tests/e2e/simulator2-load.spec.ts` guards that replay chunks, Pixi chunks, and API requests are absent from the initial simulator screen. `test:e2e:replay` verifies the default Pixi replay path, while `test:e2e:replay-pixi` keeps focused Pixi parity/stress coverage.
- Pixi replay rendering uses a persistent scene with reusable unit/effect objects. Canvas remains available for fallback diagnostics and stable screenshot baselines.
- `npm run test:e2e:prod:simulator2` runs the same production-facing contract
  against Vercel without starting a local dev server. It verifies that the live
  route keeps replay/Pixi deferred on first paint, the default Pixi replay
  paints after simulation start, and Canvas fallback still paints without Pixi.

`/simulator` remains tracked as dev/QA performance debt. If it becomes player-facing, apply the same lazy replay/combat split.

## Acceptance Criteria

- Public auth shell is visible without waiting for Supabase session checks for unauthenticated users.
- Already-authenticated users do not see the public auth shell flash during session resume.
- Already-authenticated users with a valid cache see the cached colony while fresh bootstrap is pending.
- Authenticated refresh uses a compact sync HUD status instead of multiple full-screen loading screens.
- Fresh unauthenticated first load has no Supabase REST bad response before user action.
- Authenticated desktop first canvas stays within the Playwright startup budgets.
- `GameShell`, Pixi, realtime hooks, and heavy overlays do not load before authenticated game entry.
- Existing authenticated e2e smoke still passes.
- Required checks:
  - `npx tsc --noEmit --pretty false`
  - `npx tsx scripts/check-limits.ts --diff HEAD --json`
  - `npm test`
  - `npm run build`
  - `npm run test:e2e`
