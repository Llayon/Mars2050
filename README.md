# Mars2050

Mars2050 is a browser strategy game about building and defending a Mars colony.
The current stack is Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase, and Vitest.

## Project Layout

- `src/app/` — Next.js App Router pages and API routes.
- `src/app/simulator2/` — interactive battle sandbox for balance and QA.
- `src/domains/` — business logic by domain. This is the primary source of truth.
- `src/components/` — shared UI, game panels, and TWA-optimized screens.
- `src/hooks/` — React hooks for client data access.
- `src/__tests__/` — Vitest unit and simulation regression tests.
- `supabase/` and `supabase-schema.sql` — Supabase config and schema.
- `.project/llm-context/` — focused context files for AI agents.
- `docs/simulator-qa.md` — Combat Simulator QA instructions.

Important domains include `building`, `resource`, `map`, `colony`, `pvp`, `events`, and `combat`.
The combat domain contains the tick-based battle simulator, targeting, movement, spatial hash, steering, hazards, upgrades, and replay output.

## Development Commands

```bash
npm run dev
```
Starts the local Next.js development server.

```bash
npm test
```
Runs Vitest unit and combat simulation tests.

```bash
npx tsc --noEmit --pretty false
```
Runs TypeScript type checking without emitting files.

```bash
npm run lint:limits
```
Runs the architecture enforcer (`scripts/check-limits.ts`).

```bash
npm run build
```
Runs architecture checks and builds the app.

## Architecture Rules

Business logic belongs in `src/domains/{feature}/`. API routes should stay thin: validate input, call the domain service, return a structured response.

Client components must not perform direct database mutations. Use API routes for mutations and Supabase RLS-protected reads through hooks.

Combat simulation must stay deterministic for seeded replays. Avoid nondeterministic ordering, full-map target scans by default, and unseeded randomness inside the simulation path.

## Environment

Copy `.env.local.example` to `.env.local` and provide Supabase and Telegram values as needed. Never expose `SUPABASE_SERVICE_ROLE_KEY` to client code.
