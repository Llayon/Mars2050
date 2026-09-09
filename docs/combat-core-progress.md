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
| E2–E4: срезы по аудиту | E1 и уточнённый граф | `implementing` | Срез E2-S1: развязка UNIT_TYPES и squad compiler |
| B1: автономный бой | Минимальные срезы по E0 | `pending` | Нет |
| Ранний summon | B1 / spawn-срез | `pending` | Нет |
| E5 | Принятые необходимые срезы | `pending` | Нет |
| E6 | Принятые необходимые срезы и перенос B1 | `pending` | Нет |
| E7 | E2–E6, B1 | `pending` | Нет |

## Текущий цикл

- Срез / номер попытки / цель: E2-S1 / попытка 1 / развязка `UNIT_TYPES` и `squad-compiler`: передача определений через контекст боя, предотвращение мутаций входа.
- Принятые зависимости и критерии приёмки: E1 принят; отсутствие прямых обращений к глобальному `UNIT_TYPES` в `compileSquadBundles`, сохранение точного расхода PRNG и координат baseline.
- Исполнитель / разрешённые файлы / запреты: Antigravity Agent / `src/domains/combat/combat.squad-compiler.ts`, `src/domains/combat/combat.engine.ts`, `src/domains/combat/combat.unit-stat-compiler.ts` / запрет на изменение поведения или результатов симуляции.
- Snapshot до запуска тестов: clean commit E1.
- Путь к manifest и логам без секретов: `artifacts/combat-qa/`
- Запись исходников приостановлена; snapshot после команд совпадает: подтверждено.
- Хеш архива и результат внешнего потребителя для package-check: `570c56d2f7b106c956a6727d945b4becb83019de116dd348cefcca31bbe8b9a6` (`PASS`: consumer smoke verification passed, unexported subpaths blocked).
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

## Независимое ревью

- Reviewer / отдельная сессия / UTC: Independent Read-Only Architecture Reviewer (subagent `a8254614-0ce6-40db-af7f-d6b1e4f5e39e`) / 2026-09-09 21:22 UTC.
- Проверенные критерии и snapshot: чистый commit E0 + `packages/combat-core` scaffold + contracts + wire codec + archive smoke.
- Вердикт: `PASS`.

| ID замечания | Критерий / файл / доказательство | Исправление / проверка | Статус |
| --- | --- | --- | --- |
| REV-E0-INIT | Чистота окружения и подтверждение baseline тестов | Все baseline команды выполнены с кодом 0 | `PASS` |
| REV-E0-ADR15 | Соответствие ADR-015 инвариантам плана (Zod only, zero Mars imports, determinism) | Проверено независимым ревьюером | `PASS` |
| REV-E0-TESTS | Покрытие координатных сценариев, препятствий, глобалок и призыва | 6 тестов в `combat.baseline-matrix.test.ts` пройдены | `PASS` |
| REV-E1-PACKAGE | Изоляция пакета, exports map, строгий ESM tsconfig, только Zod | Проверено независимым ревьюером | `PASS` |
| REV-E1-SMOKE | Внешний архивный smoke тест, блокировка закрытых subpaths | Проверено в изолированном tmpdir, sha256 570c56d2... | `PASS` |
| REV-E1-LIMITS | Расширение COMBAT_DEFENSE_MUTATION и IMPORT_RULES на packages/ | Регрессионные тесты architecture.* пройдены | `PASS` |

## Решения, блокеры и восстановление

- Новые подтверждённые факты последней попытки: E1 полностью принят независимым ревьюером, package smoke и architecture guards активны.
- Последовательных попыток без прогресса: 0.
- Открытые blockers: нет.
- Одобренные пользователем изменения scope/полномочий/бюджета: получено подтверждение пользователя на начало реализации.
- Последний принятый checkpoint: Milestone E1 checkpoint.
- Устаревшие проверки после изменений / что повторить: нет.
- Следующий точный шаг: переход к срезу E2-S1 (развязка UNIT_TYPES и squad compiler).

## Итог запуска

- Статус: `implementing` (E2 content decoupling).
- Реально принятые этапы и коммиты: E0 (commit `5dafddf`), E1 (в процессе фиксации).
- Незавершённые критерии / невыполненные проверки / риски: переход к E2–E4 и рубежу B1.
- Финальная интеграционная проверка и независимое ревью: `NOT_RUN` (запланировано на E7).
- Разрешённые и фактически выполненные внешние действия: нет.
- Что нужно следующей сессии или пользователю: продолжение выполнения срезов E2–E4 и раннего рубежа B1.
