# Combat-core isolation: журнал remediation (R0–R7)

План: `docs/combat-core-isolation-remediation-plan.md`. Исторический журнал extraction: `docs/combat-core-progress.md` (не перезаписывать, это новый файл).

## Запуск и окружение

| Поле | Значение |
| --- | --- |
| Run ID / старт UTC / дедлайн UTC | `run-20260914-1450` / 2026-09-14 14:50 UTC / 2026-09-14 18:50 UTC (4ч wall-clock) |
| Статус запуска | `implementing` (R0) |
| Модель / клиент | Muse Spark / OpenCode |
| Координатор / писатель | OpenCode agent (single writer, `D:\Max\Mars2050`) |
| Ветка / HEAD при старте | `repair/combat-core-isolation` / `180e3d1d158214fedb0c6b78956cb825f8483b07` (совпал с ожидаемым, `git status` чист кроме документов плана) |
| Грязное дерево при старте | `M docs/combat-core-agent-prompt.md` (указатель на R0–R7), `M docs/combat-core-extraction-plan.md` (дополнение 2026-09-14), `?? docs/combat-core-isolation-remediation-plan.md` — сохранено, войдёт в документационный checkpoint |
| Исторический baseline | `0097e7d777582be8ea45319f66edae1cf910e6b0` (только differential) |
| OS / Node / npm / браузер | win32 / Node v25.6.0 / npm 11.9.0 / Chromium Playwright 1.61.1 (установлен) |
| Reviewer | Одна read-only reviewer-сессия средствами клиента в пределах бюджета (засчитана пользователем). При недоступности — review-bundle + `needs_external_review` |
| Разрешения | Локальные изменения + checkpoint-коммиты task-файлов после проверок. Push/PR/merge/deploy/publish/миграции БД/production запрещены |
| Матрица R7 | Windows+Node 25.6.0+Chromium подтверждены; Node 22 Win/Linux — `NOT_RUN`; Docker down — `NOT_RUN` |

## Реестр ISO

| ID | Статус | Срез | Evidence |
| --- | --- | --- | --- |
| ISO-01 | `needs_external_review` (код+тесты R2a) | R2a | `definitions.test.ts` 13/13, matrix 7/7, challenge 4 FAIL на реверте |
| ISO-02 | `needs_external_review` (код+тесты R2a) | R2a | `UNSUPPORTED_ATTACK_TYPE`, coercion удалён, Mars не использует beam/spread |
| ISO-03 | `needs_external_review` (код+тесты R2b) | R2b | timeout-матрица 3/3, terminal precedence, matrix S6+S6b 8/8 |
| ISO-04 | `needs_external_review` (код+тесты R2b) | R2b | ticks 0/1/5, same-tick order, attribution, reject unknown kinds |
| ISO-05 | `open` | R3a | — |
| ISO-06 | `open` | R3b | — |
| ISO-07 | `open` | R1,R7 | — |
| ISO-08 | `open` | R6 | — |
| ISO-09 | `open` | R5 | — |
| ISO-10 | `open` | R4a | — |
| ISO-11 | `open` | R4b | — |
| ISO-12 | `open` | R2–R3,R7 | — |
| ISO-13 | `open` | R1,R6–R7 | — |

Финальное состояние extraction: `needs_revision` (старый журнал остаётся историей, здесь — новая приёмка).

## Текущий цикл

- Срез / попытка / цель: R0 / попытка 1 / достоверная исходная точка: inventory + воспроизводители ISO-01–06 + проверки ISO-07–13 + Mars baseline fixtures.
- Snapshot до работы: `180e3d1` + грязные документы плана (см. выше).
- Ветка ремонта: `repair/combat-core-isolation` (создана от `180e3d1`, грязные документы сохранены).

## R0: inventory (факт, HEAD 180e3d1, свежий dist пересобран `npm run combat:core:build`)

### Production/test импорты пакета

- Mars `src/domains/combat/*.ts` и `ecs/*.ts` — ~120 файлов `export * from '@mars2050/combat-core/<internal>'`, включая `combat.runner`, `combat.unit-compiler`, `combat.spawn-spec-compiler`, `combat.definition-mapper`, весь `ecs/*` (`combat-world`, `defense-resource-commit`, …). Это обход package boundary через Mars-обёртки: любой код Mars может дотянуться до internals, не трогая exports пакета.
- Реальные production callers (вне `__tests__`, вне обёрток): `combat.engine.ts` (`simulateBattle` → `combat.facade`), `combat.facade.ts` (`registerCombatSimulator(executeCombatSimulation)` из своей же обёртки `./combat.runner`), `combat.config.ts:74-77` (`registerDefaultCombatCatalog({unitTypes: UNIT_TYPES, upgrades: UPGRADES})`), `combat.input-translator.ts:96-99` (`catalog: {unitTypes, upgrades}` через `Record<string,unknown>`), `combat.compat-mapper.ts` (`__marsCompat`). Прямых импортов `domains/combat/ecs/*` и `combat.runner|unit-compiler|spawn-spec-compiler|definition-mapper|squad-compiler` из production-кода вне домена-обёртки нет (проверено `git grep`).
- Тесты: ~70 файлов `src/__tests__` импортируют `@/domains/combat/ecs/combat-world` (через обёртку) + `combat.unit-compiler`. Для R6 это test-only доступ, который нельзя публиковать и которым не должно пользоваться приложение.
- Внешних потребителей экспериментального API вне репозитория не выявлено (пакет не опубликован; `examples/fantasy-combat` — единственный второй потребитель, только `simulateCombat` + `contracts`).

### Таблица поле → преобразование → исполнитель → тест

| Поле схемы | Mapper / compiler | Runtime | Тест до R0 |
| --- | --- | --- | --- |
| `statusOnHit` | `combat.definition-mapper.ts:8-37` дропает (нет в `UnitTypeConfig.baseStats`) → `compileUnitStats`/`getRuntimePrimitiveStats` не видят → `unit.statusOnHit` пусто | status-system не срабатывает | Нет (E7 matrix только `console.warn`) |
| `healTargetTags` | Там же дропает → `compileRuntimeRules` (`unit-compiler.ts:210`) даёт `undefined` → `canEcsReceiveHeal` (`targeting-evaluation.ts:110-111`) возвращает `true` всем | Лечатся запрещённые цели | Нет |
| `attackType` beam/spread | Mapper молча → `single` (`definition-mapper.ts:9-16`); внутренний `UnitTypeConfig.attackType` (`combat.types.ts:39`) вообще не знает beam/spread | Исполняется чужая атака | Нет |
| `scheduledEffects[].tick` | Runner строит `ActiveGlobalEffect` без `tick` (`runner.ts:33-36`) + каст `type as ScheduledGlobalEffectKind` без валидации | `global-effect-system.ts:39` падает на скрытые `getTriggerTick` (50/100/150) | Нет |
| `timeoutPolicy` attacker_win | Runner маппит только `defender_win→defender_holds`, остальное → `draw` (`runner.ts:22`); `math/outcome.ts:3` знает только draw/defender_holds | `attacker_win` → draw | Нет |
| `definitions` unknown id | `createSpawnBuildSpecs` возвращает `[]` (`spawn-spec-compiler.ts:32-33`), RNG не тронут, ошибки нет | Тихий пустой бой | Нет |
| placement без x/y | `Math.floor(rng.next()*320)` + полоса (`spawn-spec-compiler.ts:42`) | y вне 100×100 (наблюдено y=-41) | Нет |
| `catalog` | `input.catalog as unknown as CombatCatalog` (`runner.ts:26`) + 8 fallback-точек `?? getDefaultCombatCatalog()` (squad-compiler, unit-compiler, unit-stat-compiler, support-aura-config, upgrade-primitives, ecs-runtime, entity-factory, 3 spawn-системы) | Глобальный изменяемый каталог | Нет |
| traits alien_ | `unit-compiler.ts:238-240` (единственное место в пакете) | — | Нет |

### Проверки ISO-07–13 (окружение, без кода)

- ISO-07 FAIL: `package.json` (нет `core build` до typecheck/test/build), `.github/workflows/ci.yml:37-61` (после `npm ci` сразу проверки, сборки core нет).
- ISO-08 FAIL: `node -e import(...)` — `@mars2050/combat-core/combat.runner` → `executeCombatSimulation`, `@mars2050/combat-core/ecs/combat-world` → `CombatWorld` резолвятся через production exports.
- ISO-09 FAIL: `getDefaultCombatCatalog` в 8 точках + `registerDefaultCombatCatalog` (`combat.catalog.types.ts:46-54`, вызывается `combat.config.ts:77`) + `activeSimulator/registerCombatSimulator` (`facade/combat-facade.ts:6-14`, вызывается `src/domains/combat/combat.facade.ts:5`) + `alien_` ×3 (`unit-compiler.ts:238-240`).
- ISO-10 FAIL: `profile.__marsCompat` (`runner.ts:109-117`), читает `compat-mapper.ts:22-28` с fallback на raw `SimUnit`.
- ISO-11 FAIL: только legacy `engineVersion/engineRevision` (`version.ts`, V8/V9); отдельных contract/engine-build/ruleset/replay identities нет.
- ISO-12 FAIL: `run-battle.ts:84` (`MageStatus` warn вместо assert), `:158-159` (`Timeout` warn), summon-сценарии только `console.log` без assert.
- ISO-13 FAIL: `scripts/test-combat-package.ts` — только schema/round-trip smoke без боя; negative import проверяет несуществующий `@mars2050/combat-core/dist/contracts/unit.contracts.js` (даёт MODULE_NOT_FOUND вместо ERR_PACKAGE_PATH_NOT_EXPORTED); `npm.cmd`/`tsc.cmd` хардкод (`:18`,`:62`,`:182`).

## R2b: timeout и scheduled effects как данные (ISO-03, ISO-04) — green, review pending

Критерий: таймаутная матрица и точные effect ticks через публичный API/архив; Mars globals и outcome regression совпадают. Момент terminal checks, ожидание pending impacts/hazards/reassembly и порядок фаз не менялись.

### RED

- Новые `packages/combat-core/tests/rules.test.ts` (8 тестов): 4/7 FAIL на коде до фикса (attacker_win→draw; strike в 100 вместо 5; multi-tick эффекты не в срок; unknown kind — silent no-op). draw/defender_win, terminal-precedence и tick-0 shields уже были корректны и зафиксированы как lock-in.

### FIX

- `math/outcome.ts`: `TIMEOUT_POLICIES` расширен `attacker_holds`; `getTimeoutOutcome` возвращает attacker/defender/draw соответственно. Потребители политики ограничены runner + clock resource (проверено grep).
- `combat.runner.ts`: явное 3-стороннее сопоставление (`attacker_win→attacker_holds`, `defender_win→defender_holds`, иначе `draw`); `tick` проводится в `ActiveGlobalEffect`; неизвестные kinds бросают `CombatDefinitionError('UNSUPPORTED_SCHEDULED_EFFECT', effectId, effectType)` до создания мира. Убран каст `as ScheduledGlobalEffectKind`.
- `combat.definition-error.ts`: второй код + поля effectId/effectType (переиспользуется R3a).
- `src/domains/combat/combat.input-translator.ts`: нормализация sim-имён (`attacker_holds→attacker_win`, `defender_holds→defender_win`, иначе `draw`). Поведение для всех существующих caller/test значений (draw/defender_holds) идентично;стройный тип опций contract-имена никогда не содержал, что подтвердил tsc в процессе.
- `examples/fantasy-combat/src/run-battle.ts`: сценарий S6b `attacker_win` со строгим assert (timeout/attacker/10).

### GREEN (frozen snapshot)

| Команда | Exit | Результат |
| --- | --- | --- |
| `npm run test:combat:core` | 0 | 21/21 (6 contracts + 7 definitions + 8 rules) |
| `npm test` (full, после правки транслятора) | 0 | 201/812 — Mars без изменений |
| `npm run typecheck` | 0 | rebuild core + tsc чист (включая фикс транслятора) |
| `check-limits --json` (full) | 0 | passed, 0 violations |
| goldens V8/V9 | 0 | 7+7 stable (legacy-моменты 50/100/150 задаёт адаптер как и раньше) |
| `test:combat:package:runtime` | 0 | новый tarball bab73cb8…, melee+summon |
| fantasy matrix | 0 | 8/8 (S6 defender_win + S6b attacker_win) |

### Challenge

- Временная копия (удалена): возвращены старый 2-сторонний mapping и потеря `tick` → 3 FAIL (attacker_win, strike-tick, multi-effect). Unknown-kind класс доказан RED-прогоном (4-й FAIL до фикса). Валидация оставлена нетронутой намеренно — отдельный класс исправления.

### Review / решение

- Статус: `needs_external_review` (нет capable-review; bundle = раздел + diff + команды).
- ISO-03, ISO-04 закрыты кодом+тестами. Mars legacy timing сохранён (transulator ticks + goldens).

## R2a: публичные definitions исполняются (ISO-01, ISO-02, ISO-12 частично) — green, review pending

Критерий: публичный фасад и архивный потребитель подтверждают реальные эффекты; локальный контрольный возврат потери поля ломает тест. Mars baseline не меняется.

### RED

- Новые `packages/combat-core/tests/definitions.test.ts` (7 тестов) на коде до фикса: 6/7 FAIL. Шестой (1:1 mapping single/aoe/spawn/heal) проходил и до — корректно, coercion касалась только beam/spread.
- Важная находка RED-фазы: боевые события статусов называются `status_apply`/`status_tick`, а не `status` (`combat.actions.ts:9`, `status-application-system.ts:61`). Фильтр `type==='status'` в R0-репродусере и Fantasy-матрице был вакуозным (ноль при любом коде) — это и есть один из механизмов ISO-12. Исправлено в тесте, репродусере и матрице.

### FIX

- `combat.definition-mapper.ts`: `statusOnHit`/`healTargetTags` проводятся в `UnitTypeConfig.baseStats` (копии); beam/spread бросают типизированный `CombatDefinitionError('UNSUPPORTED_ATTACK_TYPE', definitionId, attackType)` вместо silent `single`. Runtime-представления beam/spread нет (только `beamAttack`-геометрия из конфигов, `combat.weapon-validation.ts:4-31`), нового движка не писалось, контрактная версия не менялась — отклонение явное и версионируется здесь решением + тестами.
- `combat.definition-error.ts` (новый): код + definitionId + attackType; переиспользуется R3a-валидацией. Экспорт добавлен в корень пакета (facade/DTO-уровень, не ECS).
- `examples/fantasy-combat/src/run-battle.ts`: MageStatus — фильтр `status_apply|status_tick` + throw вместо warn; Healer — пара pre-damaged healers (`currentHp: 25`) + asserts (organic heal >0, orc heals =0). Self-heal невозможен по дизайну (`support-targeting.ts:12` исключает себя) — сценарий это учитывает. Timeout/summon-warn оставлены срезам R2b/R3.
- Mars не затронут: `buildMarsUnitDefinitions` проецирует те же поля, а в runner ключи definitions совпадают с ключами catalog (`UNIT_TYPES`), где полная статистика уже была. Mars не использует beam/spread (grep пуст).

### GREEN (frozen snapshot)

| Команда | Exit | Результат |
| --- | --- | --- |
| `npm run test:combat:core` | 0 | 13/13 (6 contracts + 7 definitions) |
| `npm test` (full) | 0 | 201/812 — Mars без изменений |
| `npm run typecheck` | 0 | rebuild core + tsc чист |
| `check-limits --json` (full) | 0 | 0 violations |
| goldens V8/V9 | 0 | 7+7 stable |
| `test:combat:package:runtime` | 0 | melee+summon на новом tarball (sha 617163a6…) |
| fantasy matrix (`tsc -p` + `node dist/run-battle.js`) | 0 | 7/7 со строгими burn/heal asserts |
| repro `repro-iso01-06.ts` | 1 (ожидаемо) | ISO-01/ISO-02 PASS (burn 40/0, org 31/mech 0, explicit reject); ISO-03–06 FAIL — открытые R2b/R3a/R3b |

### Challenge

- Временная копия `artifacts/r2a-challenge` (удалена после проверки): убраны ровно 2 строки passthrough → 4 FAIL: оба mapper-теста + оба семантических battle-теста (burn, heal); beam/spread-тесты зелёные. Чувствительность семантики доказана, не только parse.
- Негативный контроль синтаксической поломкой не подменялся; общая копия не трогалась.

### Review / решение

- Статус: `needs_external_review` (та же причина — нет capable-review; bundle = раздел + diff + команды).
- ISO-01, ISO-02 закрыты кодом+тестами; ISO-12 частично (mage/healer asserts; summon/timeout — позже).

## R1: чистая сборка и ранний архивный runtime smoke — `implementing` → green, review pending

Критерий: свежий source snapshot готовится и проверяется документированными командами; минимальный runtime и summon работают у внешнего архивного потребителя. Закрытые exports остаются открыто-FAIL (ISO-08, до R6).

### RED (до фикса, свежий dist)

- `dist` скрыт → `npx tsc --noEmit --pretty false` даёт TS2307 (модуль `@mars2050/combat-core` не найден): typecheck зависел от ручного/закэшированного dist. Попутно найдено: `tsconfig.json` включал gitignored `artifacts/*.ts` в проверку — исправлено исключением `artifacts`.
- Старого runtime smoke не существовало (`test:combat:package` — только schema/round-trip + неверный negative subpath `dist/contracts/unit.contracts.js`, стр. `test-combat-package.ts:187-196` до правки).

### FIX (минимальный, только infra/упаковка, runtime не тронут)

- `package.json`: `typecheck` (core build → tsc), `test`/`dev`/`prebuild` с обязательным `combat:core:build` впереди; новые `test:combat:core`, `test:combat:package:runtime`. Без рекурсивного build, версии стека/менеджер не менялись.
- `vitest.config.ts`: root исключает `packages/**` (без двойного прогона).
- `packages/combat-core/vitest.config.ts` + `packages/combat-core/tests/contracts.test.ts` (6 тестов, Node env, без jsdom/Mars setup/app env).
- `scripts/test-combat-package.ts`: кроссплатформа (`npm`/`tsc` по `process.platform` вместо `npm.cmd`/`tsc.cmd`/`npx.cmd`); negative imports заменены на 4 реальных internal subpath (`combat.runner`, `combat.unit-compiler`, `ecs/combat-world`, `ecs/defense-resource-commit`) с требованием именно `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- `scripts/test-combat-package-runtime.ts` (новый): pack → install в tmpdir → настоящий melee (атаки/урон>0, determinism, frozen, JSON round-trip, явные позиции) + in-combat summon (spawnType/team/owner attribution) — только tarball и declared deps.
- `.github/workflows/ci.yml`: явный `npm run combat:core:build` после `npm ci` в обоих jobs (локально, без push).
- `tsconfig.json`: exclude `artifacts`; `.gitignore`: `packages/*/node_modules` (кэш vitest); `README.md`: новые команды запуска.

### GREEN (frozen snapshot, свежий dist)

| Команда | Exit | Результат |
| --- | --- | --- |
| `npm run test:combat:package:runtime` | 0 | melee 48 attacks/48 damage + determinism/frozen/round-trip; 2 imp spawns, owner attribution; tarball sha256 зафиксирован в выводе |
| `npm run test:combat:package` | 1 (честный известный FAIL) | schema smoke PASS; BOUNDARY FAIL: все 4 internals RESOLVED (ISO-08 открыт до R6, `needs_revision` экспорта, не скрипта) |
| `npm run combat:core:check` | 0 | core tsc noEmit чист |
| `npm run test:combat:core` | 0 | 6/6, Node env |
| `npm run typecheck` при скрытом dist | 0 | сам пересобрал core (`tsc -p tsconfig.json` в выводе) и прошёл — ordering доказан end-to-end |
| `npx tsx scripts/check-limits.ts --json` (full scan) | 0 | 0 violations |
| `npm test` (full, включает rebuild core) | 0 | 201 files / 812 tests PASS — тот же счёт, что baseline: дабл-прогона core-тестов нет, регрессий нет |
| V8/V9 goldens + baseline-matrix | 0 | из R0, combat-источники в R1 не менялись (см. freeze) |

Freeze: `git status` после всех команд — только файлы FIX-списка + документы; `packages/combat-core/src`, `src/` нетронуты; dist/node_modules-мусора нет. Полный clean Next build повторяется в R7 по плану (в R1 доказан chain через typecheck/prebuild).

### Challenge (чувствительность гейтов)

- Ordering: пара RED (bare tsc без dist → TS2307) / GREEN (ordered `typecheck` → rebuild+PASS) — гейт чувствителен к отсутствию сборки.
- Runtime smoke: 7 проверяемых свойств (атаки, урон, determinism, frozen, round-trip, spawn, attribution); тот же `simulateCombat`-путь доказанно FAIL-способен R0-репродусером (7/7 FAIL на этом dist). Полная mutation-проверка smoke — в R2-срезах на их дефектах.
- Boundary guard: временное открытие subpath не требуется — guard уже красный на всех 4 путях; R6 перевернёт его в зелёный тем же кодом.

### Review / решение

- Capable-review недоступен (см. R0 review-bundle); статус R1: `needs_external_review`. Bundle: этот раздел + команды выше (повторяемы) + `git diff` FIX-списка.
- Зависимостей от непринятых фиксов нет (runtime не менялся); R2a может идти следующим срезом.

## R0: статус и review-bundle

- Статус R0: `needs_external_review`. Попытка reviewer-сессии `ses_f5bf7e045ffehe5rALj7In1I38` (subagent `reviewer`): агент не имел shell/file-инструментов (только blender/playwright/web), ничего не проверил — все пункты `NOT_RUN`, вердикт `needs_revision` по форме «не проверено». Это недоступность capable-review, а не найденный дефект. Код R0 не менялся (только `docs/*` + gitignored `artifacts/`), поэтому R1 продолжается как независимый срез; приёмка всех срезов требует capable-review.
- Review-bundle R0 = этот журнал (§R0 inventory + §R0 evidence) + `artifacts/combat-isolation-r0/red-iso01-06.log` + `repro-iso01-06.ts` + `debug-hist.ts` + snapshot `180e3d1` (грязные только документы плана). Повторная проверка: `npm run combat:core:build`, затем `npx tsx artifacts/combat-isolation-r0/repro-iso01-06.ts` (ожидается exit 1, 7/7 FAIL), `npx tsx scripts/combat-ecs-golden.ts [--v9]`, `npx vitest run src/__tests__/combat.baseline-matrix.test.ts`.
- Замечание ревьюера по форме принято: журнал уже содержит file:line по каждому ISO и командам; недостающие номера строк (обёртки — `export *` в строке 1; `combat.config.ts:74-77`; `input-translator.ts:96-99`; `compat-mapper.ts:22-28`; `facade/combat-facade.ts:6-14`; `math/outcome.ts:3-18`; `test-combat-package.ts:18,62,182 npm.cmd/tsc.cmd`, `:187-196` неверный negative subpath) зафиксированы здесь.

### Аномалия часов среды (влияет на учёт бюджета)

- Старт зафиксирован `[DateTime]::UtcNow` = 2026-09-14 14:50 UTC. Следующее чтение в этом же запуске: 2026-09-15 08:10 UTC (local UTC+3, 11:09). Разница ≈17ч20м при ≈30 мин реальной работы (десяток команд). Вывод: часы среды скакнули, wall-clock ненадёжен.
- Решение: работа продолжается с ручным учётом (цель — объём ≈4ч реальной работы: R0 done, далее R1, затем R2a по остатку), факт disclosed в журнал и итог. Если владелец сочтёт бюджет исчерпанным по машинным часам — срезы сверх R0 помечать `stopped_budget` задним числом не требуется, т.к. часы недостоверны; решение за владельцем по отчёту.

## R0: evidence

| UTC / snapshot | Команда / cwd / окружение | Exit | Статус | Результат |
| --- | --- | --- | --- | --- |
| 14:50 UTC / `180e3d1`+грязные доки | `git rev-parse HEAD; git status; git log -5` / `D:\Max\Mars2050` / win32 Node 25.6.0 | 0 | PASS | HEAD совпал `180e3d1`; грязные только 2 указателя + untracked план |
| 14:5x UTC / `180e3d1` | `npm run combat:core:build` | 0 | PASS | dist пересобран из HEAD (привязка RED к свежему dist) |
| 14:5x UTC / fresh dist | `npx tsx artifacts/combat-isolation-r0/repro-iso01-06.ts` / win32 Node 25.6.0 | 1 | RED (ожидаемо) | 7/7 FAIL, механизмы точные: burn 0/0 при 71 атаке; mechHeals=5 при orgHeals=31; beam/spread→single; timeout winner=draw; hazard в tick 100 вместо 5; silent empty battle; y=-41 на 100×100. Лог: `artifacts/combat-isolation-r0/red-iso01-06.log` |
| 14:5x UTC | `npx tsx scripts/combat-ecs-golden.ts` (+`--v9`) | 0 | PASS | V8 и V9 stable, по 7 пресетов (Mars baseline держится) |
| 14:5x UTC | `npx vitest run src/__tests__/combat.baseline-matrix.test.ts` | 0 | PASS | 7/7 (координаты/frozen/immutable) |
| 14:5x UTC | `node -e import(internals)` | 0 | FAIL (ISO-08, ожидаемо) | runner + ecs/combat-world резолвятся |

Уточнения воспроизводителей (зафиксировать для R2b): outcome-system даёт `stalemate ticks=0` при attack=0 с обеих сторон (`outcome-system.ts:18-23`), поэтому timeout/scheduled/heal-фикстуры обязаны иметь attack>0 (иначе terminal наступает раньше timeout). `canTeamDealDamage` не учитывает дистанцию — достаточно attack>0 и нелетающих целей.

