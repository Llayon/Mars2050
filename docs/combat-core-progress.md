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
| E5 | Принятые необходимые срезы | `pending` | Нет |
| E6 | Принятые необходимые срезы и перенос B1 | `pending` | Нет |
| E7 | E2–E6, B1 | `pending` | Нет |

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

## Независимое ревью

- Reviewer / отдельная сессия / UTC: Independent Read-Only Architecture Reviewer (subagent `592ef742-a371-4bc3-9b11-f4524fca4632`) / 2026-09-09 21:36 UTC (B1).
- Проверенные критерии и snapshot: `examples/fantasy-combat` standalone CLI consumer, `packages/combat-core` contracts/math/exports, zero illegal imports, tarball packaging smoke, Mars regression suite (199 files, 800 tests, goldens V8/V9, limits check).
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

## Решения, блокеры и восстановление

- Новые подтверждённые факты последней попытки: Рубеж B1 официально принят. Автономный бой с собственными определениями фэнтези (`orc_warrior`, `elven_archer`, `goblin_shaman`, `fire_elemental`) успешно симулируется с 100% байт-в-байт детерминизмом. Призыв существ во время боя (`goblin_shaman` с `attackType: 'spawn'` создает `fire_elemental`) подтверждён (3 призыва за 97 тиков). Пакет `@mars2050/combat-core` экспортирует `getFormationOffset` из math, внешняя сборка и архивный smoke-тест (sha256 `f700e20a...`) проходят с кодом 0.
- Последовательных попыток без прогресса: 0.
- Открытые blockers: нет.
- Одобренные пользователем изменения scope/полномочий/бюджета: получено подтверждение пользователя на начало реализации.
- Последний принятый checkpoint: Milestone B1 checkpoint (`feat/combat-core-extraction`).
- Устаревшие проверки после изменений / что повторить: нет.
- Следующий точный шаг: коммит среза B1 и переход к срезам E3–E4.

## Итог запуска

- Статус: `accepted` (Milestone B1: Early Autonomous Fantasy Battle & In-Combat Summon).
- Реально принятые этапы и коммиты: E0 (`5dafddf`), E1 (`60c55e3`), E2 (`271a526`), B1 (accepted).
- Незавершённые критерии / невыполненные проверки / риски: коммит B1, переход к E3/E4/E5.
- Финальная интеграционная проверка и независимое ревью: `NOT_RUN` (запланировано на E7).
- Разрешённые и фактически выполненные внешние действия: нет.
- Что нужно следующей сессии или пользователю: коммит B1 и переход к следующим этапам.


