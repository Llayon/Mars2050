# Public Load Performance

Last updated: 2026-07-04

## Original Problem

Opening `https://mars2050.vercel.app/` in a fresh browser can show the generic loading screen for several seconds before the public auth page appears.

This is separate from authenticated game/canvas loading. The public auth page was gated behind client-side auth initialization.

## Live Baseline

Measured with Playwright in fresh browser contexts against production Vercel:

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
- The test blocks `_next/static/chunks/**` to verify the no-flash behavior before app runtime hydration.

## Current Live Result

After deployment:

| Scenario | Result |
| --- | --- |
| Fresh unauthenticated browser | Public auth shell visible at about 0.5-0.8 s in repeated live Playwright checks |
| Fresh unauthenticated browser | 0 API requests before public shell |
| Fresh unauthenticated browser | About 220 KB JS transfer and 15 KB CSS transfer before the shell settles |
| Auth marker present, app chunks blocked | Resume shell visible, public auth shell hidden |

## Authenticated Game Entry Budget

The next performance target is the already-authenticated path:

`AuthRuntime -> session -> colonyId -> GameShell -> /api/colonies/bootstrap -> HUD/canvas`

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

## Simulator Routes

`/simulator` and `/simulator2` are static routes but intentionally heavier than `/`: live checks showed roughly 300 KB JS transfer and 18 JS files on the first screen because Pixi/combat/replay code belongs to those entrypoints.

They are tracked as dev/QA performance debt, not as the primary player-load path. If these routes become player-facing, lazy-load replay/Pixi work after the user starts a simulation.

## Acceptance Criteria

- Public auth shell is visible without waiting for Supabase session checks for unauthenticated users.
- Already-authenticated users do not see the public auth shell flash during session resume.
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
