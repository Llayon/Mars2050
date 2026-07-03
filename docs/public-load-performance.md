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
| Fresh unauthenticated browser | Public auth shell visible at about 1.5 s in live Playwright check |
| Fresh unauthenticated browser | No bad responses before public shell |
| Auth marker present, app chunks blocked | Resume shell visible, public auth shell hidden |

## Acceptance Criteria

- Public auth shell is visible without waiting for Supabase session checks for unauthenticated users.
- Already-authenticated users do not see the public auth shell flash during session resume.
- Fresh unauthenticated first load has no Supabase REST bad response before user action.
- `GameShell`, Pixi, realtime hooks, and heavy overlays do not load before authenticated game entry.
- Existing authenticated e2e smoke still passes.
- Required checks:
  - `npx tsc --noEmit --pretty false`
  - `npx tsx scripts/check-limits.ts --diff HEAD --json`
  - `npm test`
  - `npm run build`
  - `npm run test:e2e`
