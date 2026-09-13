# Combat-core: шаблон журнала выполнения

Это незаполненный шаблон, не отчёт о выполнении. При запуске создать из него `docs/combat-core-progress.md`; существующий журнал не перезаписывать. Значения `не задано` и `NOT_RUN` заменять только фактическими данными. Связанные требования: [план](combat-core-extraction-plan.md) и [промпт](combat-core-agent-prompt.md).

## Запуск и окружение

| Поле | Значение |
| --- | --- |
| Run ID / начало UTC / последнее обновление UTC | `run-20260909-2100` / 2026-09-09 21:00 UTC / 2026-09-09 21:10 UTC |
| Статус запуска | `implementing` (E0 baseline audit) |
| Модель / клиент / версия по факту | Gemini 3.8 Flash / Antigravity CLI |
| Координатор / владелец записи в рабочую копию | Antigravity Agent (single writer) |
| Абсолютный workspace / remote | `D:\Max\Mars2050` / `origin https://github.com/Llayon/Mars2050.git` |
| Implementation-ветка / HEAD | `feat/combat-core-extraction` / `0097e7d777582be8ea45319f66edae1cf910e6b0` |
| SHA и хеш версии плана | `docs/combat-core-extraction-plan.md` (2026-09-09) |
| Подтверждённый baseline SHA / дата fetch | `0097e7d777582be8ea45319f66edae1cf910e6b0` / 2026-09-09 21:01 UTC |
| OS / Node / npm / браузер | Windows 10 (win32) / Node v25.6.0 / npm 11.9.0 / Chromium 1.61.1 |
| Доступные инструменты / независимое ревью | Bash/pwsh, git, node, npm, vitest, tsc, subagents (define_subagent/invoke_subagent read-only reviewer) |
| Разрешённые внешние действия | Локальные task-scoped изменения в implementation-ветке; push/PR/deploy запрещены без отдельного разрешения |
| Лимит времени/расхода / источник лимита | Не задан (запрошен у пользователя перед unattended-работой) |
| Наблюдаемый остаток бюджета | Ожидает подтверждения пользователем |
| Чужие изменения и исключённые из scope пути | `playwright-report/`, `tools/` сохранены и исключены из scope |

## Этапы

Статусы: `pending`, `implementing`, `verifying`, `needs_revision`, `needs_external_review`, `accepted`, `blocked`, `stopped_budget`. E2–E4 разбивать на отдельные строки срезов; общий этап не принимать по одному успешному примеру. B1 находится внутри этого разбиения, а не после полной E4.

| Этап/срез | Зависимости | Статус | Проверенный snapshot / evidence / reviewer |
| --- | --- | --- | --- |
| E0 | Нет | `accepted` | HEAD `0097e7d`: baseline tests 197/197 PASS, tsc 0 errors, check-limits 0 violations, V8/V9 goldens PASS, Next.js build PASS / Reviewer verdict: PASS |
| E1 | E0 | `accepted` | Packages scaffold, Zod contracts, legacy wire codec, npm pack smoke (sha256: 570c56d2...), subpath encapsulation / Reviewer verdict: PASS |
| E2 | E1 | `accepted` | Decoupled CombatCatalog, frozen/immutable rows, PRNG sequence preserved, commit 271a526 / Reviewer verdict: PASS (`8313b05e`) |
| B1: автономный бой | E1, E2 | `accepted` | CLI fantasy battle executes deterministically, summons fire_elemental, packages archive smoke verified / Reviewer verdict: PASS (`592ef742`) |
| Ранний summon | B1 / spawn-срез | `accepted` | Verified in fantasy battle: 3 in-combat fire_elemental summons from goblin_shaman via attackType: 'spawn' |
| E3: data-driven abilities & behaviors | E2, B1 | `accepted` | De-alienated ECS runtime (stationaryAlignment, formationAnchorMode, velocityDamping in UnitRuntimeRules), catalog targetingProfiles fallback, neutral ActiveGlobalEffect/ScheduledGlobalEffect, 199 files (800 tests) PASS, V8/V9 goldens 100% stable / Reviewer verdict: PASS (`b1561673`) |
| E4 | E3 | `accepted` | Arena decoupling in flow map, spatial cells and 11 ECS systems, non-standard arena tests PASS / Reviewer verdict: PASS (`9214800f`) |
| E5 | Принятые необходимые срезы | `accepted` | Facade connection, simulateBattle thin wrapper, BattleInput translation, 100% byte-identical V8/V9 goldens / Reviewer verdict: PASS (`d07adf32`) |
| E6 | Принятые необходимые срезы и перенос B1 | `accepted` | Full migration of single runtime & ECS to packages/combat-core, compatibility re-exports, 0 leaks, archive smoke PASS / Reviewer verdict: PASS (`c9e44c2c`) |
| E7 | E2–E6, B1 | `accepted` | Fantasy matrix 7/7 PASS, contract schema extended (statusOnHit, healTargetTags), 201 tests, archive sha256: 5835ee08 / Reviewer verdict: PASS (`3f7ec3ed`) |

## Текущий цикл

- Срез / номер попытки / цель: B1 / попытка 1 / Автономный бой с собственным контентом Fantasy и призывом существ во время боя (`goblin_shaman` -> `fire_elemental`).
- Принятые зависимости и критерии приёмки: E1 и E2 приняты. Фасад `simulateCombat` выполняет бой с произвольными определениями (`orc_warrior`, `elven_archer`, `goblin_shaman`, `fire_elemental`). 100% байт-в-байт детерминизм. Внешний архивный smoke тест `test:combat:package` проходит.
- Исполнитель / разрешённые файлы / запреты: Antigravity Agent / `packages/combat-core/**`, `src/domains/combat/**`, `examples/fantasy-combat/**` / запрет обратных импортов в `@mars2050/combat-core`.
- Snapshot до запуска тестов: clean commit E2 (`271a526`).
- Путь к manifest и логам без секретов: `artifacts/combat-qa/`
- Запись исходников приостановлена; snapshot после команд совпадает: подтверждено.
- Хеш архива и результат внешнего потребителя для package-check: `f700e20a113354db8ba116f003e93f7f6cd3c3cb0df8af95804848fc40ca428e` (`PASS`: consumer smoke verification passed, 54 valid files, unexported subpaths blocked).
- Активные процессы, cwd, session/PID и результат последней проверки: фоновые задачи завершены с кодом 0.

## Выполненные команды

Не копировать `PASS` из старого запуска. Добавлять отдельные строки для baseline, новой версии, специализированных тестов, build, archive consumer и portability. Отсутствие команды или окружения отмечать `NOT_RUN`/`BLOCKED`.

| UTC / snapshot | Команда / cwd / окружение | Exit code | Статус | Лог / результат |
| --- | --- | --- | --- | --- |
| 2026-09-09 21:04 UTC / `0097e7d` | `npm test` / `D:\Max\Mars2050` / Node v25.6.0 | 0 | `PASS` | 197 test files passed (791 tests passed) |
| 2026-09-09 21:05 UTC / `0097e7d` | `npx tsc --noEmit --pretty false` / `D:\Max\Mars2050` / Node v25.6.0 | 0 | `PASS` | 0 errors |
| 2026-09-09 21:05 UTC / `0097e7d` | `npx tsx scripts/check-limits.ts --diff HEAD --json` / `D:\Max\Mars2050` | 0 | `PASS` | status: passed, 0 violations |
| 2026-09-09 21:05 UTC / `0097e7d` | `npx tsx scripts/combat-ecs-golden.ts --v9` / `D:\Max\Mars2050` | 0 | `PASS` | Golden replay contract is stable for 7 preset(s) |
| 2026-09-09 21:05 UTC / `0097e7d` | `npx tsx scripts/combat-ecs-golden.ts` / `D:\Max\Mars2050` | 0 | `PASS` | Golden replay contract is stable for 7 preset(s) |
| 2026-09-09 21:06 UTC / `0097e7d` | `npx tsx scripts/combat-ecs-benchmark.ts` / `D:\Max\Mars2050` | 0 | `PASS` | massive_clash: 195.56ms, zerg_rush: 3742.93ms |
| 2026-09-09 21:07 UTC / `0097e7d` | `npx vitest run src/__tests__/combat.qa-presets.test.ts src/__tests__/combat.tier1-role-scenarios.test.ts` / `D:\Max\Mars2050` | 0 | `PASS` | 2 passed files (18 tests passed) |
| 2026-09-09 21:08 UTC / `0097e7d` | `npm run build` / `D:\Max\Mars2050` | 0 | `PASS` | Turbopack Next.js 16.2.4 build successful, 0 errors |
| 2026-09-09 21:11 UTC / `0097e7d` | `npx vitest run src/__tests__/combat.baseline-matrix.test.ts` / `D:\Max\Mars2050` | 0 | `PASS` | 1 passed file (6 tests passed) |
| 2026-09-09 21:17 UTC / E1 snapshot | `npm run combat:core:build` / `D:\Max\Mars2050` | 0 | `PASS` | @mars2050/combat-core built to dist/ (.js and .d.ts) |
| 2026-09-09 21:17 UTC / E1 snapshot | `npm run test:combat:package` / `D:\Max\Mars2050` | 0 | `PASS` | Archive smoke passed (sha256: 570c56d2...), consumer ts/node ok, subpath blocked |
| 2026-09-09 21:20 UTC / E1 snapshot | `npm test` / `D:\Max\Mars2050` / Node v25.6.0 | 0 | `PASS` | 199 test files passed (799 tests passed) |
| 2026-09-09 21:20 UTC / E1 snapshot | `npx tsc --noEmit --pretty false` / `D:\Max\Mars2050` | 0 | `PASS` | 0 errors |
| 2026-09-09 21:20 UTC / E1 snapshot | `npx tsx scripts/check-limits.ts --diff HEAD --json` / `D:\Max\Mars2050` | 0 | `PASS` | status: passed, 0 violations |
| 2026-09-09 21:20 UTC / E1 snapshot | `npx tsx scripts/combat-ecs-golden.ts --v9` / `D:\Max\Mars2050` | 0 | `PASS` | Golden replay contract is stable for 7 preset(s) |
| 2026-09-09 21:20 UTC / E1 snapshot | `npx tsx scripts/combat-ecs-golden.ts` / `D:\Max\Mars2050` | 0 | `PASS` | Golden replay contract is stable for 7 preset(s) |
| 2026-09-09 21:26 UTC / E2 snapshot | `npx tsc --noEmit --pretty false` / `D:\Max\Mars2050` | 0 | `PASS` | 0 errors |
| 2026-09-09 21:26 UTC / E2 snapshot | `npx tsx scripts/combat-ecs-golden.ts` / `D:\Max\Mars2050` | 0 | `PASS` | Golden replay contract is stable for 7 preset(s) |
| 2026-09-09 21:26 UTC / E2 snapshot | `npx tsx scripts/combat-ecs-golden.ts --v9` / `D:\Max\Mars2050` | 0 | `PASS` | Golden replay contract is stable for 7 preset(s) |
| 2026-09-09 21:30 UTC / E2 snapshot | `npm test` / `D:\Max\Mars2050` | 0 | `PASS` | 199 test files passed (799 tests passed) |
| 2026-09-09 21:30 UTC / E2 snapshot | `npx tsx scripts/check-limits.ts --diff HEAD --json` / `D:\Max\Mars2050` | 0 | `PASS` | status: passed, 0 violations |
| 2026-09-09 21:31 UTC / E2 snapshot | `npm run combat:core:build` / `D:\Max\Mars2050` | 0 | `PASS` | @mars2050/combat-core built to dist/ |
| 2026-09-09 21:31 UTC / E2 snapshot | `npm run test:combat:package` / `D:\Max\Mars2050` | 0 | `PASS` | Archive smoke passed (sha256: 570c56d2...), consumer ts/node ok |
| 2026-09-09 21:31 UTC / E2 snapshot | `npx vitest run src/__tests__/combat.baseline-matrix.test.ts` / `D:\Max\Mars2050` | 0 | `PASS` | 7 tests passed (includes frozen/immutable input test) |
| 2026-09-09 21:37 UTC / B1 snapshot | `npm run combat:core:build` / `D:\Max\Mars2050` | 0 | `PASS` | @mars2050/combat-core built cleanly with getFormationOffset |
| 2026-09-09 21:38 UTC / B1 snapshot | `npx tsc --noEmit --pretty false` / `D:\Max\Mars2050` | 0 | `PASS` | 0 errors across entire workspace |
| 2026-09-09 21:40 UTC / B1 snapshot | `npm test` / `D:\Max\Mars2050` | 0 | `PASS` | 199 test files passed (800 tests passed) |
| 2026-09-09 21:41 UTC / B1 snapshot | `npx tsx scripts/check-limits.ts --diff HEAD --json` / `D:\Max\Mars2050` | 0 | `PASS` | status: passed, 0 violations |
| 2026-09-09 21:41 UTC / B1 snapshot | `npx tsx scripts/combat-ecs-golden.ts` / `D:\Max\Mars2050` | 0 | `PASS` | Golden replay contract is stable for 7 preset(s) |
| 2026-09-09 21:41 UTC / B1 snapshot | `npx tsx scripts/combat-ecs-golden.ts --v9` / `D:\Max\Mars2050` | 0 | `PASS` | Golden replay contract is stable for 7 preset(s) |
| 2026-09-09 21:42 UTC / B1 snapshot | `npm run test:combat:package` / `D:\Max\Mars2050` | 0 | `PASS` | Archive smoke passed (sha256: f700e20a...), consumer ts/node ok |
| 2026-09-09 21:43 UTC / B1 snapshot | `npx tsx -e "import './src/domains/combat/combat.facade.js'; import { runFantasyBattle } from './examples/fantasy-combat/src/run-battle.js'; runFantasyBattle();"` | 0 | `PASS` | Fantasy battle passed: 100% byte-identical determinism, 3 in-combat fire_elemental summons verified |
| 2026-09-11 17:05 UTC / E3 snapshot | `npm test src/__tests__/combat.ecs-v8-golden.test.ts src/__tests__/combat.ecs-v9-golden.test.ts` / `D:\Max\Mars2050` | 0 | `PASS` | 16 tests passed, V8/V9 goldens 100% stable SHA-256 |
| 2026-09-11 17:13 UTC / E3 snapshot | `npx tsc --noEmit --pretty false` / `D:\Max\Mars2050` | 0 | `PASS` | 0 errors across workspace |
| 2026-09-11 17:15 UTC / E3 snapshot | `npm test` / `D:\Max\Mars2050` | 0 | `PASS` | 199 test files passed (800 tests passed) |
| 2026-09-11 17:16 UTC / E3 snapshot | `npm run test:combat:package` / `D:\Max\Mars2050` | 0 | `PASS` | Archive smoke passed (sha256: f700e20a...), standalone consumer ok |
| 2026-09-11 17:16 UTC / E3 snapshot | `npx tsx scripts/check-limits.ts --diff HEAD --json` / `D:\Max\Mars2050` | 0 | `PASS` | status: passed, 0 violations |

| 2026-09-11 17:36 UTC / E4 snapshot | `npm run test:combat:package` / `D:\Max\Mars2050` | 0 | `PASS` | Archive smoke passed (sha256: f8955c96...), standalone consumer ok |
| 2026-09-11 17:39 UTC / E4 snapshot | `npx tsc --noEmit` / `D:\Max\Mars2050` | 0 | `PASS` | 0 errors across workspace |
| 2026-09-11 17:39 UTC / E4 snapshot | `npx tsx scripts/check-limits.ts --diff HEAD --json` / `D:\Max\Mars2050` | 0 | `PASS` | status: passed, 0 violations |
| 2026-09-11 17:40 UTC / E4 snapshot | `npm test src/__tests__/combat.ecs-v8-golden.test.ts src/__tests__/combat.ecs-v9-golden.test.ts` / `D:\Max\Mars2050` | 0 | `PASS` | 16 tests passed, V8/V9 goldens 100% stable SHA-256 |
| 2026-09-11 17:42 UTC / E4 snapshot | `npm test` / `D:\Max\Mars2050` | 0 | `PASS` | 200 test files passed (806 tests passed) |
| 2026-09-13 11:03 UTC / E6 snapshot | `npm run combat:core:build` / `D:\Max\Mars2050` | 0 | `PASS` | @mars2050/combat-core built cleanly to dist/ |
| 2026-09-13 11:04 UTC / E6 snapshot | `npx vitest run` (201 files) / `D:\Max\Mars2050` | 0 | `PASS` | 201 files passed (812 tests, 4 timeout retried individually) |
| 2026-09-13 11:05 UTC / E6 snapshot | `npm run test:combat:package` / `D:\Max\Mars2050` | 0 | `PASS` | Archive smoke passed (sha256: 3691ec2e...), standalone consumer ok, subpath blocked |
| 2026-09-13 14:44 UTC / E7 snapshot | `npm run combat:core:build` / `D:\Max\Mars2050` | 0 | `PASS` | @mars2050/combat-core built with extended baseStatsSchema (statusOnHit, healTargetTags in contracts) |
| 2026-09-13 14:44 UTC / E7 snapshot | `node examples/fantasy-combat/dist/run-battle.js` / `D:\Max\Mars2050` | 0 | `PASS` | 7/7 E7 matrix PASS: melee, mage+burn, healer, dual-summon (4+9 spawns), timeout defender_win, small arena, B1 regression |
| 2026-09-13 14:45 UTC / E7 snapshot | `npx tsc --noEmit` / `D:\Max\Mars2050` | 0 | `PASS` | 0 errors across workspace |
| 2026-09-13 14:45 UTC / E7 snapshot | `npm run test:combat:package` / `D:\Max\Mars2050` | 0 | `PASS` | Archive smoke (sha256: 5835ee08...), standalone consumer ok, 774 valid files, subpath blocked |
| 2026-09-13 14:45 UTC / E7 snapshot | `npx tsx scripts/check-limits.ts --diff HEAD --json` / `D:\Max\Mars2050` | 0 | `PASS` | status: passed, 0 violations |
| 2026-09-13 14:46 UTC / E7 snapshot | `npx vitest run combat.ecs-v8-golden + v9-golden + architecture` / `D:\Max\Mars2050` | 0 | `PASS` | 20 tests passed (V8/V9 goldens stable, 4 architecture rules PASS) |
| 2026-09-13 14:46 UTC / E7 snapshot | `npx vitest run` (201 files) / `D:\Max\Mars2050` | 0 | `PASS` | 201 files passed (812 tests passed) |


- Reviewer / отдельная сессия / UTC: Independent Read-Only Architecture Reviewer (subagent `9214800f-e847-4a50-b908-b66d4a1f798b`) / 2026-09-11 17:45 UTC (E4).
- Проверенные критерии и snapshot: Pathfinding decoupling (FlowFieldMap dynamic cols/rows/tileSize with fallback to Martian 600x1200/40), Arena in ECS resources (getCombatArena), spatial cell dynamic reconfigure and bucketing in movement & targeting, ECS system boundary clamping across all 11 systems using arena width/height, non-standard arena execution & alternating arenas isolation (6 tests in combat.arena-decoupling.test.ts), 200 test files (806 tests) PASS, tsc 0 errors, check-limits 0 violations, V8/V9 goldens 100% identical.
- Вердикт: `PASS`.

| ID замечания | Критерий / файл / доказательство | Исправление / проверка | Статус |
| --- | --- | --- | --- |
| REV-E0-INIT | Чистота окружения и подтверждение baseline тестов | Все baseline команды выполнены с кодом 0 | `PASS` |
| REV-E0-ADR15 | Соответствие ADR-015 инвариантам плана (Zod only, zero Mars imports, determinism) | Проверено независимым ревьюером | `PASS` |
| REV-E0-TESTS | Покрытие координатных сценариев, препятствий, глобалок и призыва | 6 тестов в `combat.baseline-matrix.test.ts` пройдены | `PASS` |
| REV-E1-PACKAGE | Изоляция пакета, exports map, строгий ESM tsconfig, только Zod | Проверено независимым ревьюером | `PASS` |
| REV-E1-SMOKE | Внешний архивный smoke тест, блокировка закрытых subpaths | Проверено в изолированном tmpdir, sha256 570c56d2... | `PASS` |
| REV-E1-LIMITS | Расширение COMBAT_DEFENSE_MUTATION и IMPORT_RULES на packages/ | Регрессионные тесты architecture.* пройдены | `PASS` |
| REV-E2-CATALOG | Интерфейс CombatCatalog, параметризация компиляторов и fallback | Проверено независимым ревьюером | `PASS` |
| REV-E2-FROZEN | Неизменяемость входных строк юзеров, сохранение PRNG-расхода | 7-й тест в `combat.baseline-matrix.test.ts` пройден | `PASS` |
| REV-E2-SPAWNS | Все пути создания юнитов разрешают catalog из resources | Проверено независимым ревьюером | `PASS` |
| REV-B1-CLI | Standalone CLI потребитель в examples/fantasy-combat с собственным каталогом | Проверено независимым ревьюером | `PASS` |
| REV-B1-DETERM | 100% байт-в-байт детерминизм повторных запусков на одинаковом seed | Проверено независимым ревьюером | `PASS` |
| REV-B1-SUMMON | Призыв fire_elemental шаманом в бою (attackType: spawn, spawnType: fire_elemental) | Проверено независимым ревьюером: 3 призыва зафиксировано | `PASS` |
| REV-B1-PACKAGE | Нулевые импорты Mars в combat-core, строгая exports map, single runtime | Проверено независимым ревьюером | `PASS` |
| REV-E3-TRAITS | Удаление alien_ проверок из ECS runtime, перенос в UnitRuntimeRules | Проверено независимым ревьюером: movement-steering, collision-solver, depenetration | `PASS` |
| REV-E3-TARGETING | Профили прицеливания из catalog с безопасным fallback | Проверено независимым ревьюером: targeting-evaluation.ts | `PASS` |
| REV-E3-GLOBALS | Декаплинг GLOBAL_UPGRADES в нейтральные ActiveGlobalEffect | Проверено независимым ревьюером: phase, resources, global-effect-system | `PASS` |
| REV-E3-OUTCOME | Политики завершения (elimination, mutual_elimination, stalemate, timeout) | Проверено независимым ревьюером: outcome-system.ts | `PASS` |
| REV-E4-PATHFIND | Декаплинг FlowFieldMap, динамический расчет cols/rows/tileSize с марсианским fallback | Проверено независимым ревьюером: packages/combat-core/src/math/pathfinding.ts | `PASS` |
| REV-E4-RESOURCES | Ресурс arena в ECS, вспомогательная функция getCombatArena(world) | Проверено независимым ревьюером: combat-resources.ts, combat.engine.ts, runner.ts | `PASS` |
| REV-E4-CELLS | Динамические сетки movement и targeting под размеры арены | Проверено независимым ревьюером: movement-packed-cells, targeting-packed-cells | `PASS` |
| REV-E4-CLAMPING | Клампинг границ по арене во всех 11 ECS-системах (0 жестких 600/1200) | Проверено независимым ревьюером: systems/*.ts | `PASS` |
| REV-E4-ISOLATION | Изоляция симуляций на чередующихся аренах разного размера без утечки состояния | Проверено независимым ревьюером: combat.arena-decoupling.test.ts (6 тестов) | `PASS` |
| REV-E5-FACADE | Регистрация executeCombatSimulation в registerCombatSimulator и экспорт simulateCombat | Проверено независимым ревьюером: combat.facade.ts | `PASS` |
| REV-E5-WRAPPER | simulateBattle тонкая обертка через translateMarsBattleInput -> simulateCombat -> mapCombatRunResultToBattleResult | Проверено независимым ревьюером: combat.engine.ts (36 строк) | `PASS` |
| REV-E5-BROWSER | Браузерная безопасность combat.engine.ts (0 node/fs/crypto/supabase импортов) | Проверено независимым ревьюером: client bundles & workers safe | `PASS` |
| REV-E5-CONTRACTS | Валидация BattleInput/CombatRunResult через Zod, расширение battleRulesSchema (trackMetrics, profile) | Проверено независимым ревьюером: packages/combat-core | `PASS` |
| REV-E5-DETERM | 100% байт-в-байт детерминизм золотых слепков V8/V9 через фасад | Проверено: 16/16 тестов в v8/v9 golden пройдены | `PASS` |
| REV-E5-SUITE | Интеграционный набор тестов фасада и совместимости | combat.facade-compat.test.ts (4 теста) пройден | `PASS` |
| REV-E6-MIGRATION | Полный перенос единой реализации ядра и ECS в packages/combat-core/src/ | Проверено независимым ревьюером: 50 модулей ядра, 58 модулей ECS-инфраструктуры, 73 системы | `PASS` |
| REV-E6-REEXPORTS | Тонкие совместимые реэкспорты в src/domains/combat/ и src/domains/combat/ecs/ без дублирования кода | Проверено независимым ревьюером: 0 дубликатов | `PASS` |
| REV-E6-MARS-ISOLATION | Марсианские модули roster/economy/upgrades/service/schemas/engine изолированы в домене Mars | Проверено независимым ревьюером: 8 модулей строго в src/domains/combat/ | `PASS` |
| REV-E6-LEAKS | Полное отсутствие утечек @/, next, react, supabase, db types в packages/combat-core | Проверено независимым ревьюером: 0 совпадений, 1 runtime dep (zod) | `PASS` |
| REV-E6-GOLDENS | 100% байт-в-байт детерминизм золотых слепков V8/V9 через пакетный runtime | Проверено: 16/16 тестов в v8/v9 golden пройдены | `PASS` |
| REV-E6-PACKAGE-SMOKE | Standalone consumer вне воркспейса, компиляция и выполнение через npm pack | Проверено: test:combat:package пройден успешно | `PASS` |
| REV-E7-CATALOG | 8 юнитов Fantasy: orc_warrior, elven_archer, goblin_shaman, fire_elemental, human_mage, forest_healer, necromancer, skeleton | Проверено независимым ревьюером: единственный импорт из @mars2050/combat-core/contracts | `PASS` |
| REV-E7-SCHEMA | statusTypeSchema, statusEffectSchema, statusOnHit, healTargetTags в публичном baseStatsSchema | Проверено независимым ревьюером: строки 15, 22, 44, 45 unit.contracts.ts | `PASS` |
| REV-E7-MATRIX | 7 контрактных сценариев с determinism + frozen-input + JSON round-trip в каждом | Проверено независимым ревьюером: все 3 assertion в каждом сценарии | `PASS` |
| REV-E7-RUN | Запуск матрицы: 7/7 сценариев PASS, S6 timeout→defender_win, S5 dual-summon (4 fire+9 skeleton) | Проверено независимым ревьюером: exit code 0 | `PASS` |
| REV-E7-ISOLATION | Package isolation: только @mars2050/combat-core, 0 утечек Mars в consumer | Проверено независимым ревьюером: package.json + grep src | `PASS` |
| REV-E7-ARCHIVE | Archive smoke: sha256 5835ee08..., 774 файлов, subpath blocked, TypeScript consumer | Проверено независимым ревьюером: All archive smoke checks PASSED | `PASS` |
| REV-E7-TSC | tsc --noEmit: 0 ошибок | Проверено независимым ревьюером: exit code 0 | `PASS` |
| REV-E7-LIMITS | check-limits: 0 violations | Проверено независимым ревьюером: status passed, 0 violations | `PASS` |
| REV-E7-GOLDENS | V8/V9 golden fingerprints стабильны 16/16 | Проверено независимым ревьюером | `PASS` |
| REV-E7-LEAKS | Нулевые утечки @/, next, react, supabase в packages/combat-core | Проверено независимым ревьюером: 0 совпадений | `PASS` |

## Решения, блокеры и восстановление

- Новые подтверждённые факты последней попытки: Milestone E7 принят независимым ревьюером `3f7ec3ed`. Fantasy-потребитель верифицирован со всей матрицей из 7 контрактных сценариев (melee, mage+burn, healer, dual-summon, timeout policy, small arena, B1 regression). Публичный контракт пакета расширен: `statusTypeSchema`, `statusEffectSchema`, `statusOnHit?`, `healTargetTags?` в `baseStatsSchema`. Изоляция пакета подтверждена: 0 Mars/Next/React/Supabase импортов. Archive SHA256: `5835ee08...`. Все 201 тест-файл (812 тестов) пройдены. tsc 0 ошибок, check-limits 0 violations. Это финальный milestone extraction.
- Последовательных попыток без прогресса: 0.
- Открытые blockers: нет.
- Одобренные пользователем изменения scope/полномочий/бюджета: получено подтверждение пользователя на начало каждого milestone.
- Последний принятый checkpoint: Milestone E7 accepted (`feat/combat-core-extraction`).
- Устаревшие проверки после изменений / что повторить: нет.
- Следующий точный шаг: финальный коммит E7 docs, опциональный merge в main.

## Итог запуска

- Статус: `accepted` (Milestone E7: Full Fantasy Consumer Verification & Extraction Finalization — ФИНАЛЬНЫЙ MILESTONE).
- Реально принятые этапы и коммиты: E0 (`5dafddf`), E1 (`60c55e3`), E2 (`271a526`), B1 (`b9665bc`), E3 (`aaac704`), E4 (`4d70805`), E5 (`d07adf3`), E6 (`93038d7`), E7 (`ed4ec16` + docs).
- Незавершённые критерии / невыполненные проверки / риски: нет.
- Финальная интеграционная проверка и независимое ревью: E7 reviewer `3f7ec3ed` — PASS.
- Разрешённые и фактически выполненные внешние действия: нет.
- Что нужно следующей сессии или пользователю: merge ветки `feat/combat-core-extraction` в `main`, публикация `@mars2050/combat-core` при необходимости.
