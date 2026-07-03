# Public Load Performance Plan

Last updated: 2026-07-04

## Problem

Opening `https://mars2050.vercel.app/` in a fresh browser can show the generic loading screen for several seconds before the public auth page appears.

This is separate from authenticated game/canvas loading. The public auth page is currently gated behind client-side auth initialization.

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

`src/app/page.tsx` is a client component and renders `Loading Mars2050...` while `useAuth()` initializes. For an unauthenticated visitor, the browser must download and execute the startup JS bundle, initialize Supabase auth/session state, run effects, and only then render the public auth UI.

The public auth screen should be server/static HTML first. Auth/session resume should run after first paint and redirect into the game only when a real session is found.

## Implementation Plan

1. Add a public-load Playwright perf smoke for `/` with a fresh browser context.
2. Split the page into a static public shell and a client runtime boundary.
3. Render the auth shell immediately from server/static HTML.
4. Lazy-load auth modal code only after login/register intent.
5. Keep `GameShell` lazy and load it only after session + colony are known.
6. Move normal desktop session checking out of the public first-paint path.
7. Remove or defer the Supabase connectivity probe so it does not issue a public first-load `401`.
8. Verify unauth first-load chunks do not include game/Pixi/realtime code.

## Acceptance Criteria

- Public auth shell is visible without waiting for Supabase session checks.
- Fresh unauthenticated first load has no Supabase REST bad response before user action.
- `GameShell`, Pixi, realtime hooks, and heavy overlays do not load before authenticated game entry.
- Existing authenticated e2e smoke still passes.
- Required checks pass:
  - `npx tsc --noEmit --pretty false`
  - `npx tsx scripts/check-limits.ts --diff HEAD --json`
  - `npm test`
  - `npm run build`
  - `npm run test:e2e`
