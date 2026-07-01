# LLM-Readable Context Index — Mars2050

## Краткое описание проекта
Браузерная онлайн-стратегия по колонизации Марса.
- Стек: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + Supabase.
- Геймплей: экономика, строительство, исследование карты, события, PvP, торговля, рейтинг, тиковая симуляция боя.
- Архитектура: клиент → API Routes (server) → Supabase (`service_role_key` только на сервере).
- Auth: Supabase Auth (email/password).
- Real-time: Supabase Realtime планируется.

## Ключевые директории
- `src/domains/`: бизнес-логика по доменам (`auth`, `building`, `colony`, `combat`, `events`, `leaderboard`, `map`, `pvp`, `resource`).
- `src/domains/combat/`: тиковый battle simulator, spatial hash, targeting, steering, pathfinding, statuses, damage pipeline, weapon primitives, upgrades, hazards, replay.
- `src/app/api/`: тонкие API-роуты (валидация → сервис → ответ).
- `src/app/simulator2/`: UI-песочница для тестирования и балансировки боя.
- `src/hooks/`: клиентские хуки по доменам.
- `src/components/`: UI-компоненты, game panels и TWA screens.
- `src/__tests__/`: Vitest unit/regression tests.
- `.project/llm-context/`: короткие доменные контексты для агентов.
- `docs/`: дополнительная документация (например, `simulator-qa.md`).

## Критические правила
- Не делать прямые DB-мутации из клиентских компонентов.
- Не хардкодить `SUPABASE_SERVICE_ROLE_KEY` в клиентском коде.
- Не использовать `any` без крайней необходимости.
- Не писать комментарии на русском в коде; UI-текст может быть русским.
- Все мутации через API Routes и доменные сервисы.
- Валидация входных данных через Zod.
- Существующие файлы редактировать точечно.
- Соблюдать лимиты строк из `AGENTS.md`.

## Combat Rules
- Seeded combat replay должен быть детерминированным.
- Не использовать full-map targeting по умолчанию; обычное aggro локальное, дальнобойные исключения должны быть явными.
- Spatial hash query должен сохранять детерминированный порядок.
- Movement steering должен быть дополнительным слоем, а не заменой flow/pathfinding без тестов.
- Новые боевые механики покрывать focused tests и regression metrics.

## Проверки
- `npm run lint:limits`: архитектурный enforcer.
- `npm test`: Vitest tests.
- `npx tsc --noEmit --pretty false`: TypeScript typecheck.
- `npm run build`: prebuild checks + Next build.

## Текущее состояние
- ✅ Core gameplay domains implemented: auth, building, colony, combat, events, leaderboard, map, pvp, resource.
- ✅ Combat domain implemented: tick loop, squads, local aggro, flying/ground targeting, statuses, damage/shield pipeline, support auras, mines, displacement, barriers/decoys, attack geometry, ramp damage, on-kill effects, upgrades, hazards, replay, spatial hash, sticky aggro, steering, stances, smoke suppression, split-fire, anti-summoner, armor pierce, shield breaker.
- ✅ PvP hardening implemented: auth ownership checks, battle snapshots, replay access contract, cooldowns, simulation version, practice NPC targets.
- ✅ UI Architecture overhauled: transitioned to full-screen TWA screens (Operations, Map, Colony, Buildings, Profile) with bottom navigation and Anno-style HUDs, removing old legacy desktop panels.
- ✅ Economy hardening in progress/implemented locally: dynamic production rates, workforce, happiness, housing, terrain requirements.
- ✅ Supabase Cloud project active: `gkvsnzwvgonfpuespafm`.
- ✅ Architecture enforcer and git hooks configured.
- ✅ Vitest suite includes combat regression coverage.
- ⚠️ Supabase Realtime still planned.

## Важные файлы
- `AGENTS.md`: полные правила для LLM/agents.
- `.project/llm-context/combat.md`: focused combat context.
- `.project/adrs/013-combat-simulation-determinism.md`: combat determinism decisions.
- `supabase-schema.sql`: схема БД; при изменениях синхронизировать `src/types/database.ts`.
- `scripts/check-limits.ts`: архитектурный enforcer.
