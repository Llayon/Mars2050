# Agent Handoff

Last updated: 2026-06-30

## Integration Baseline

Use the latest `origin/master` as the only integration base.

Agents must not merge old task commits by hash unless the user explicitly asks. If a branch already contains older
backend/UI/combat commits from another agent, rebase and keep only the branch's own new work above `origin/master`.

## Required Sync Flow

For a new task branch:

```bash
git fetch origin
git checkout master
git pull --ff-only origin master
git checkout -b agent/<area>-<short-task>
```

For an existing branch:

```bash
git fetch origin
git rebase origin/master
git log --oneline origin/master..HEAD
```

Before asking for review, the branch-specific log must contain only that agent's new work.

## Local Workspace Discipline

The workspace may contain untracked or dirty assets, SQL snippets, generated GIFs, PDF/Markdown references, and work
from other agents. Do not add, delete, move, or rewrite those files unless the task explicitly assigns that cleanup.

Runtime-ready unit assets should go under `public/assets/units/`. Source/reference files should go under
`assets/source/` or a documented asset pipeline folder.

## Current Work Split

### Core Combat

Scope:
- Combat config, deterministic simulation, targeting, movement, status/damage pipeline, weapon primitives, replay actions.
- Keep seeded replay deterministic and avoid unseeded randomness.
- Update `docs/combat-unit-roles.md`, `.project/llm-context/combat.md`, and `docs/simulator-qa.md` when mechanics change.

Primary files:
- `src/domains/combat/`
- `src/__tests__/combat.*.test.ts`
- `docs/combat-unit-roles.md`
- `docs/simulator-qa.md`

Do not touch:
- `src/domains/pvp/pvp.service.ts` unless the task is explicitly backend/PvP.
- Supabase migrations unless the task explicitly changes persistence.

### Simulator / Replay UI

Scope:
- Replay renderer, debug overlays, metrics display, simulator presets, visual QA docs.
- Keep `battle-replay-engine.ts` within the replay/render engine limit and extract rendering helpers.

Primary files:
- `src/app/simulator2/`
- `src/components/game/BattleReplayModal.tsx`
- `src/components/game/battle-replay-*.ts`
- `docs/simulator-qa.md`

Do not touch:
- Combat simulation rules unless the task explicitly includes core combat.
- PVP persistence/service code.

### Backend / PvP / Security

Scope:
- Auth ownership checks, cooldown race handling, replay persistence, resource persistence, API contracts.
- Keep routes thin and services below limits by extracting `pvp.*.ts` helpers.

Primary files:
- `src/domains/pvp/`
- `src/app/api/pvp/`
- `supabase/migrations/`
- `src/__tests__/pvp.*.test.ts`

Do not touch:
- Combat movement/targeting/rendering unless the task explicitly spans backend and simulation.

### Economy / Building / Population

Scope:
- Building workforce, resource rates, population happiness/growth, terrain requirements.
- Keep DB schema, `src/types/database.ts`, and context docs synchronized.

Primary files:
- `src/domains/building/`
- `src/domains/resource/`
- `src/domains/population/` when present
- `src/app/api/buildings/`
- `src/app/api/resources/`
- `src/__tests__/building.*.test.ts`
- `src/__tests__/resource.*.test.ts`
- `src/__tests__/population.*.test.ts`

### Game UI / HUD

Scope:
- Desktop HUD shell, Command Center, Base Operations, future Global Management overlay, TWA screens.
- Do not move business logic into UI components; use hooks/domain services.

Primary files:
- `src/components/game/`
- `src/components/screens/`
- `src/hooks/`
- `.project/llm-context/ui.md`

## Merge Gate

Each agent must run the relevant local checks before handoff:

```bash
npx tsc --noEmit --pretty false
npm test
npx eslint . --quiet
npx tsx scripts/check-limits.ts --diff HEAD --json
git diff --check
```

If a check fails because of pre-existing unrelated dirty work, report it explicitly with file names and do not hide it
with broad rewrites.
