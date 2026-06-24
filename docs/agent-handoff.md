# Agent Handoff

Last updated: 2026-06-24

## Integration Baseline

Use `origin/master` as the only integration base.

The backend agent commit `ac6a7a2 feat(pvp): simulation version, cooldown, atomic persistence, replay access contract`
was superseded by amended commit `47a6432` with the same backend work plus the fixed combat performance test.
Do not merge or cherry-pick `ac6a7a2` again.

After this handoff document is committed, agents must start from the latest `origin/master`, not from `47a6432`
directly.

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

Before asking for review, the branch-specific log must contain only that agent's new work. If the old backend commit
`ac6a7a2` appears in the branch history, drop it during rebase before merging.

## Local Untracked Files

The current workspace may contain local GIF, PDF, ZIP, extracted GDD, temporary transcript, and unit SVG files.
They are not part of the integration baseline.

Do not add, delete, move, or rewrite those files unless the task explicitly assigns asset cleanup. Runtime-ready unit
assets should go under `public/assets/units/`. Source/reference files should go under `assets/source/` or a documented
asset pipeline folder.

## Agent Work Split

### Agent 1: Core Combat

Work from latest `origin/master`.

Scope:
- Normalize `combatTags` and targeting profiles with clear production names. Avoid slang tags such as `chaff`.
- Keep roles emergent. Tags should describe mechanical properties, not fixed unit classes.
- Add focused tests for tag scoring, target stickiness, local acquisition, and deterministic replay stability.

Primary files:
- `src/domains/combat/combat.types.ts`
- `src/domains/combat/combat.config.ts`
- `src/domains/combat/combat.targeting.ts`
- `src/__tests__/combat.*.test.ts`

Do not touch:
- `src/domains/pvp/pvp.service.ts`
- Supabase migrations
- replay persistence

### Agent 2: Simulator UI / QA

Work from latest `origin/master`.

Scope:
- Show a replay warning when `simulationVersion` is older than the current supported snapshot version.
- Keep simulator metrics and overlays readable without growing page/component files past limits.
- Update manual QA docs only when the UI behavior actually changes.

Primary files:
- `src/app/simulator2/`
- `src/components/game/BattleReplayModal.tsx`
- `src/components/game/battle-replay-*.ts`
- `docs/simulator-qa.md`

Do not touch:
- combat target selection logic
- PVP persistence/service code

### Agent 3: Backend / Security

Work from latest `origin/master`.

Scope:
- Design the next backend hardening slice for attack rate limiting and cooldown race handling.
- Prefer a small schema-backed solution such as `attack_cooldowns` or an RPC transaction, with tests.
- Keep API routes thin and service files under the documented limits.

Primary files:
- `src/domains/pvp/`
- `src/app/api/pvp/`
- `supabase/migrations/`
- `src/__tests__/pvp.*.test.ts`

Do not touch:
- combat movement/targeting
- simulator rendering

## Merge Gate

Each agent must run the relevant local checks before handoff:

```bash
npx tsc --noEmit --pretty false
npm test
npm run lint
npx tsx scripts/check-limits.ts --diff HEAD --json
git diff --check
```

If a check fails because of a pre-existing unrelated warning, report it explicitly with file names and do not hide it
by broad rewrites.
