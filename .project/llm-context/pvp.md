# PvP Domain — Mars2050

## Файлы домена
- `src/domains/pvp/pvp.types.ts` — PvP DTO/result types.
- `src/domains/pvp/pvp.schemas.ts` — Zod schemas for attack/trade/replay ids.
- `src/domains/pvp/pvp.service.ts` — thin orchestrator: ownership → cooldown → simulate → persist → return result.
- `src/domains/pvp/pvp.ownership.ts` — user-scoped colony ownership checks.
- `src/domains/pvp/pvp.persistence.ts` — squad HP/death persistence helpers.
- `src/domains/pvp/pvp.resources.ts` — trade and attack reward resource mutations.
- `src/domains/pvp/pvp.replay.ts` — battle snapshot save/load, replay access, cooldown helpers, `SNAPSHOT_VERSION`.
- `src/domains/pvp/pvp.practice.ts` — practice/NPC defender unit generation when present.

## API Routes
- `src/app/api/pvp/attack/route.ts` — attack route, auth required, returns 429 for cooldown.
- `src/app/api/pvp/trade/route.ts` — trade route, auth required.
- `src/app/api/pvp/battle/[battleId]/route.ts` — replay loading for authorized participants.

## Hooks / UI
- `src/hooks/usePvp.ts` — client hook for attacks, trades, and replay loading.
- `src/components/game/PvpPanel.tsx` — legacy desktop panel.
- `src/components/game/command-center/` — current desktop army/PvP overlay.

## Key Types
- `AttackResult`: attack response with logs, seed, `simulationVersion`, optional `cooldownRemaining`.
- `BattleWithSnapshot`: battle row plus replay snapshot.
- `Trade`: resource exchange result.

## Service Responsibilities
- `executeAttack()`: validate ownership/cooldown, simulate combat, persist losses/rewards/snapshot.
- `executeTrade()`: validate ownership and resource offer, apply trade.
- `fetchAuthorizedBattle()`: load replay only for participants through user-scoped auth.
- `fetchBattleInternal()`: service-role replay load for tests/admin tooling.

## Current Behavior
- User id is never trusted from body/query. Routes derive it from Supabase auth context.
- Service-role mutations are allowed only after explicit JS ownership checks.
- Battle replay logs are stored in `battle_snapshots` with `seed`, `initial_state`, `log`, and `version`.
- `SNAPSHOT_VERSION` is returned as `simulationVersion`; viewer can warn on old snapshots.
- Attack cooldown prevents simulation spam but still has a race risk until DB-level locking/RPC exists.
- Practice targets use defender ids such as `npc_*` and do not persist unit losses/rewards.

## Validation
- `attackSchema`: target colony id, optional `clientSeed`, optional attack placement validation.
- `tradeSchema`: resource offer/request validation.
- `battleIdSchema`: replay route validation.

## Patterns
- Auth route → user-scoped client for ownership/read checks → service-role client for mutations.
- Keep API routes thin and use `@/lib/api-error`.
- Keep `pvp.service.ts` under 250 lines by moving helpers into `pvp.*.ts` modules.
- If local workspace has `pvp.service.ts` over 250 lines or `as any`, fix that in a backend-only slice before merging.

## Known Risks
- Battle insert and snapshot insert may still be non-atomic unless wrapped in RPC/transaction.
- Cooldown can race under simultaneous attacks without DB-level lock/unique cooldown row.
- Practice targets are for dev/QA and must stay clearly separated from ranked/PvP persistence.
