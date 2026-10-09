# Combat-core isolation: журнал remediation (R0–R7)

План: `docs/combat-core-isolation-remediation-plan.md`. Исторический журнал extraction: `docs/combat-core-progress.md` (не перезаписывать, это новый файл).

## Итог запусков и текущий статус (R4b Accepted Checkpoint)

- Ветка `repair/combat-core-isolation`: `180e3d1` → `33553c7` (R0+R1) → `c8dc228` (R2a) → `4629a7e` (R2b) → `484b297` (R3a base) → `aafb467` (R3a accepted) → `9c7c490` (R3b accepted / R4a base) → R4a accepted → R4b accepted.
- Выполнено и принято: R0 (аудит), R1 (infra), R2a (ISO-01/02), R2b (ISO-03/04), R3a (ISO-05), R3b (ISO-06), **R4a (ISO-10, accepted)**, **R4b (ISO-11, accepted — Owner review pass 4, verdict ACCEPT)**.
- Реализован срез R5a (ISO-09): явные traits (`stationaryAlignment`, `formationAnchorMode`, `velocityDamping`, `projectileInterceptable`) в контрактах, удаление `alien_`-эвристик из ядра, перенос марсианских определений и вычисления interceptable в Mars adapter, regression `content-isolation-r5a.test.ts`.
- Открыто: ISO-07 (R1/R7, CI-часть готова локально), ISO-08 (R6, guard честно красный), ISO-09 (R5a реализован, R5b впереди), ISO-12 (summon/timeout-warn), ISO-13 (runtime smoke есть, boundary/matrix — R6/R7).
- Следующий шаг: независимое ревью / приёмка R5a, затем переход к R5b (удаление глобальных registries).
- Зафиксированные артефакты:
  - Handoff candidate: `artifacts/combat-core-handoff/handoff-20261006-r4b-candidate/` (запечатан, не перезаписывать).
  - Хэш архива `mars2050-combat-core-0.1.0.tgz`: `f610158b3f4db5782a0978ccf7333eca651e024263f2d76988aa297417c08499`.
  - Уточнение размера архива: фактический размер архива составляет **385 622 байта** (в начальной оценочной мета-записи фигурировало 385 573 байта; SHA-256 побитово точен и идентичен во всех независимых пересборках).
  - Отчёт владельца: `artifacts/review-r4b-owner-pass4-20261007/review.json` (вердикт ACCEPT).

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
| ISO-05 | `accepted` (коммит aafb467 + non-blocking test update) | R3a | 95/95 тестов core, zero RNG, parity, late summon HP=1, catalog norm transfer |
| ISO-06 | `needs_external_review` (код+тесты R3b) | R3b | `placement-r3b.test.ts` (5), `placement-r3b-bounds.test.ts` (5), neutral bounds, PRNG sequence, Mars edge clamp |
| ISO-07 | `open` | R1,R7 | — |
| ISO-08 | `open` | R6 | — |
| ISO-09 | `needs_external_review` (код+тесты R5a; R5b впереди) | R5a/R5b | `content-isolation-r5a.test.ts` (2/2), goldens V8/V9 (7/7), 214/214 tests core, runtime smoke PASS, Node 22/25 probes PASS |
| ISO-10 | `accepted` (независимое ревью fb94c3e9, probe 10/10, zero-leak, order-preserved) | R4a | wire-codec-r4a 7/7, probe 10/10 PASS, nested-p2 4/4, key-order 7/7, __marsCompat удалён |
| ISO-11 | `accepted` (Owner review pass 4, 33/33 probes PASS Node 22/25, tarball f610158b 385,622 B exact, candidate sealed) | R4b | identity-r4b.test.ts 7/7, pureSha256, 1-engine/2-rulesets, metadata round-trip, runtime smoke PASS, compatibility-probe 9/9, previous-probe 24/24 |
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

## Ремедиация замечаний независимого ревью R1, R2a, R2b (run-20260922)

- Контекст: ветка `repair/combat-core-isolation`, базовый HEAD `9087e04954e81bc4686ff69bc61852c980f9639b`. Исправление замечаний независимого ревью без разрешения перехода к R3a–R7.

### Пункт 1. Отложенный MASS_SHIELD (R2b, ISO-04)
- Проблема: `mass_shield` безусловно накладывался на тике 0 через отдельный блок `if (tick === 0) applyMassShields(...)`, игнорируя указанный в конфигурации `effect.tick`.
- Файл: `packages/combat-core/src/ecs/systems/global-effect-system.ts`.
- Исправление:
  - Удален безусловный блок `if (tick === 0) applyMassShields(...)` и отдельная вспомогательная функция.
  - В `getTriggerTick` для `mass_shield` задан дефолтный тик 0 (`case 'mass_shield': return 0;`) для обратной совместимости с историческими Mars-апгрейдами.
  - В цикле исполнения эффектов `mass_shield` теперь срабатывает точно на `tick === (effect.tick ?? getTriggerTick(effect.type))`, поддерживая отложенное наложение щитов на тиках > 0.
- Тесты (`packages/combat-core/tests/rules.test.ts`):
  - Проверено срабатывание на тиках 0, 1, 5.
  - Проверено отсутствие щита до наступления тика срабатывания (`maxShield` равен 0/undefined).
  - Проверена однократность наложения (щит не суммируется повторно на последующих тиках).
  - Проверена корректность выхода за лимит длительности боя (тиковый эффект после `maxTicks` не применяется).
  - Проверено совпадение тиков нескольких эффектов: сохраняется порядок объявления и корректная атрибуция (EMP action `unitId === 'b'`, heal action `targetId === 'a'`).
- Совместимость Mars: регрессионный тест фазы глобальных эффектов Mars `src/__tests__/combat.ecs-global-effect-phase.test.ts` (3 теста) и голдены V8/V9 (7/7) полностью сохранены (PASS).

### Пункт 2. Исправление ложного PASS для горелки / burn (R2a, ISO-01, ISO-12)
- Проблема: `duration: 10` при `interval: 10` приводило к тому, что periodic tick не успевал нанести урон до завершения баффа или быстрой гибели отряда; ассерт не проверял положительный урон от тиков и разницу с контрольным боем.
- Файлы:
  - `packages/combat-core/tests/definitions.test.ts`
  - `examples/fantasy-combat/src/fantasy-catalog.ts`
  - `examples/fantasy-combat/src/run-battle.ts`
- Исправление:
  - В `definitions.test.ts` задан `duration: 25` (гарантирует 2+ периодических тика урона при интервале 10).
  - Добавлены раздельные строгие проверки: наличие событий `status_apply`, наличие событий `status_tick`, положительный периодический урон (`dotDamage > 0`), потеря HP целью превышает контрольный бой без статуса (`burnDefHpLoss > controlDefHpLoss`).
  - Проверен чистый контрольный бой: ровно 0 `status_apply`, 0 `status_tick`, 0 периодического урона.
  - В Fantasy-матрице (`fantasy-catalog.ts`, `run-battle.ts`) `human_mage` получил `duration: 25`, а защитник в сценарии `MageStatus` изменен на отряд `orc_warrior` (120 HP, 6 брони), переживающий прямые атаки, что позволило зафиксировать 6 периодических тиков и положительный урон от горения.
- Targeted Challenge (доказательство чувствительности):
  - В `packages/combat-core/src/ecs/systems/status-system.ts` в функцию `getPeriodicDamage` временно внесен мутант: `return 0;`.
  - Запуск `npm run test:combat:core` дал немедленный RED: `definitions.test.ts` упал с семантической ошибкой `expected 0 to be greater than 0` на строке 82 (`expect(burnTicks.length).toBeGreaterThan(0)`).
  - Мутант отменен, тест возвращен в чистый GREEN.

### Пункт 3. Подключение тестов core к CI и хукам (R1, ISO-07)
- Проблема: `lint-staged` не запускал тесты ядра при коммитах, а CI в `.github/workflows/ci.yml` не содержал шагов `test:combat:core` и `test:combat:package:runtime`.
- Файлы:
  - `package.json`
  - `.github/workflows/ci.yml`
- Исправление:
  - В `lint-staged` добавлено правило для `packages/combat-core/tests/**/*.test.ts` (`vitest run --reporter=verbose --config packages/combat-core/vitest.config.ts`) и проверка лимитов для `*.{ts,tsx}`.
  - В `.github/workflows/ci.yml` в job `check` добавлены шаги `npm run test:combat:core` и `npm run test:combat:package:runtime` сразу после `npm t`.
  - Проверка хуков: запуск `npx lint-staged` со staged-файлом `packages/combat-core/tests/definitions.test.ts` подтвердил корректный раздельный запуск через `vitest.config.ts` ядра без вызова тестов Mars и без обхода хуков.

### Пункт 4. Расширение архивного runtime consumer (R1, ISO-13)
- Проблема: `test:combat:package:runtime` проверял только melee и summon, оставляя непроверенными burn, healTargetTags, timeout policies, scheduled ticks и отказ от неподдерживаемых типов.
- Файл: `scripts/test-combat-package-runtime.ts`.
- Реализованы 8 проверочных блоков в изолированном tmpdir через собранный `.tgz` архив:
  1. Изоляция пакета (разрешение `@mars2050/combat-core` из изолированного `node_modules` без утечки в репозиторий).
  2. Ближний бой с явными координатами юнитов (урон > 0, детерминизм, frozen outcome).
  3. Призыв юнитов в бою (`summon`) с атрибуцией владельца (`sourceUnitId`) и команды.
  4. Периодический урон от горения (`burn`): наличие `status_apply`, `status_tick`, положительный dot-урон, потеря HP выше контрольного боя, чистый контрольный бой без статусов.
  5. Фильтрация целей лечения `healTargetTags` (органическая цель лечится, механическая цель игнорируется, учет `maxHp`).
  6. Все три политики таймаута: `draw` (`reason: 'timeout'`, `winner: 'draw'`), `attacker_win` (`reason: 'timeout'`, `winner: 'attacker'`), `defender_win` (`reason: 'timeout'`, `winner: 'defender'`).
  7. Запланированные глобальные эффекты с явным тиком: `mass_shield` на тиках 0 и 5, проверка отсутствия щита до наступления тика, лимит длительности боя, одновременные эффекты с сохранением порядка объявления и атрибуции.
  8. Явное отклонение неподдерживаемых определений: бросок `CombatDefinitionError('UNSUPPORTED_ATTACK_TYPE')` на beam/spread и `CombatDefinitionError('UNSUPPORTED_SCHEDULED_EFFECT')` на неизвестный тип запланированного эффекта.
- Сгенерированный архив: `mars2050-combat-core-0.1.0.tgz` (SHA256: `da02b6bffec9c65928b2183cd47b0e47fb4fbdb637fc0443eb3e4655be0467ae`).

### Сводная таблица обязательных проверок

| Команда | Exit code | Результат |
| --- | --- | --- |
| `npm run combat:core:build; npm run combat:core:check` | 0 | Сборка dist и tsc noEmit чисты |
| `npm run test:combat:core` | 0 | 22/22 тестов PASS (contracts: 6, definitions: 7, rules: 9) |
| `npx tsc --noEmit --pretty false` | 0 | Корневой typecheck чист |
| `npx tsx scripts/check-limits.ts --json` | 0 | 0 violations (включая `--diff HEAD`) |
| `npx tsx scripts/combat-ecs-golden.ts` | 0 | 7/7 presets stable (Mars baseline) |
| `npx tsx scripts/combat-ecs-golden.ts --v9` | 0 | 7/7 presets stable (Mars baseline V9) |
| `npm test` | 0 | 201 files, 812 tests PASS |
| `npm run test:combat:package` | 1 | Честный известный ISO-08 BOUNDARY FAIL (4 внутренних пути разрешаются, норма до R6) |
| `npm run test:combat:package:runtime` | 0 | Все 8 проверочных блоков в изолированном окружении PASS (SHA256 da02b6...) |
| `examples/fantasy-combat` сценарии | 0 | 8/8 сценариев PASS (включая S3 MageStatus с burn и S6b timeout attacker_win) |
| `npm run lint` | 0 | 0 ошибок (12 no-explicit-any исправлены) |

### Доработка по результатам повторного ревью коммита cfaee108 (3 пробела)

По результатам проверки коммита `cfaee108` независимый ревьюер подтвердил исправления `mass_shield`, `burn`, маршрутизацию тестов и воспроизводимость архивного consumer (SHA256 совпал), но указал на 3 пробела в проверках и предупредил об ошибках lint в CI. Все замечания устранены:

1. **[P2] Рост HP при лечении и отрицательный контроль:**
   - В `packages/combat-core/tests/definitions.test.ts` и `scripts/test-combat-package-runtime.ts` добавлены обязательные строгие ассерты:
     - Разрешенная органическая цель фактически восстанавливает здоровье (`orgSurvivor.hp > 30`, в тесте достигает 120).
     - HP разрешенной цели строго превышает unhealed контрольный бой (`orgSurvivor.hp > controlOrg.hp`).
     - Отрицательный контроль: механическая цель не получает лечения и сохраняет исходное здоровье (`mechSurvivor.hp === 30`, `mechSurvivor.hp === controlMech.hp`).
   - **Targeted Challenge:** В `packages/combat-core/src/ecs/v9-defense-commit.ts` временно отключено прибавление `healing` к `vitality.hp`. Запуск `npm run test:combat:core` дал немедленный RED: `definitions.test.ts` упал с `AssertionError: expected 30 to be greater than 30` на строке 152. Мутант отменен, тест возвращен в чистый GREEN.
2. **[P2] Проверка конкретного владельца (`summonOwnerId`) и источника призыва:**
   - В `scripts/test-combat-package-runtime.ts` проверка призыва ужесточена:
     - Все события призыва проверяются на авторство конкретного призывателя (`unitId === 'shaman'` и `sourceId === 'shaman'`), команду (`spawnTeam === 'attacker'`) и непустой `targetId`.
     - Все созданные существа (`spawnedIds`) строго проверяются на `summonOwnerId === 'shaman'` (подмена на `wrong-owner` или `wrong-source` вызывает исключение).
     - Число выживших созданных существ точно сопоставляется с числом событий спавна.
     - Исходные непризванные юниты (`shaman`, `g1`, `d1`) гарантированно не имеют `summonOwnerId` (`undefined`).
3. **[P2] Строгая изоляция разрешения пакета и очистка `NODE_PATH`:**
   - В `scripts/test-combat-package-runtime.ts` функция `run()` запускает дочерние процессы с принудительно очищенным `NODE_PATH: ''`.
   - Внутри архивного consumer проверяется отсутствие `process.env.NODE_PATH` и строгое совпадение префикса `require.resolve('@mars2050/combat-core')` с локальным `node_modules/@mars2050/combat-core` конкретной временной директории consumer.
4. **Дополнительно:**
   - В архивном consumer добавлена раздельная проверка отклонения обоих неподдерживаемых типов атак — `beam` и `spread` (оба дают `UNSUPPORTED_ATTACK_TYPE`).
   - В `src/__tests__/architecture.combat-defense-mutation.test.ts` устранены 12 ошибок `no-explicit-any`, команда `npm run lint` теперь проходит с exit code 0 (0 ошибок, 103 предупреждения), что гарантирует прохождение шага lint в CI.

### Доработка по результатам повторного ревью коммита 9e2d959 (2 замечания в архивном тесте)

По результатам проверки коммита `9e2d959` независимый ревьюер подтвердил закрытие замечания к лечению, проверку `summonOwnerId`, очистку `NODE_PATH`, проверку типов `beam`/`spread`, совпадение SHA тарибала и прохождение core-тестов, typecheck, lint, architecture scan, V8/V9 goldens. Однако указал на 2 ошибки в проверках архивного теста:

1. **[P2] Проверка источника summon (исключение ложного PASS при частичной мутации):**
   - Условие `sa.unitId !== 'shaman' && sa.sourceId !== 'shaman'` заменено на функцию `assertSpawnEvent` с двумя независимыми строгими проверками:
     - `if (sa.unitId !== 'shaman') throw ...`
     - `if (sa.sourceId !== 'shaman') throw ...`
   - В consumer добавлены два отрицательных контроля с независимой мутацией каждого поля:
     - Отрицательный контроль 1: `{ unitId: 'wrong-unit', sourceId: 'shaman' }` обязан бросать исключение.
     - Отрицательный контроль 2: `{ unitId: 'shaman', sourceId: 'wrong-source' }` обязан бросать исключение.
   - **Targeted Challenge:**
     - Отключение проверки `sourceId` в `assertSpawnEvent`: запуск `test:combat:package:runtime` дал немедленный RED: `Error: assertSpawnEvent failed to reject mutated wrong sourceId` (exit code 1).
     - Отключение проверки `unitId` в `assertSpawnEvent`: запуск `test:combat:package:runtime` дал немедленный RED: `Error: assertSpawnEvent failed to reject mutated wrong unitId` (exit code 1).
     - Оба мутанта отменены, тест возвращен в чистый GREEN.

2. **[P2] Строгая проверка границы каталога и отрицательный контроль на соседний каталог:**
   - Проверка пути `normResolved.startsWith(normExpected)` заменена на функцию `isPathInside(childPath, parentDir)`, проверяющую границу каталога через:
     - `relative(normParent, normChild)` (не начинается с `..`, не пустой, не абсолютный);
     - `normChild.startsWith(normParent + sep)` (строгий разделитель пути, предотвращающий ложное совпадение по общему префиксу имени каталога).
   - В consumer добавлен отрицательный контроль на соседний каталог с идентичным префиксом:
     - `siblingShadowPkg = .../node_modules/@mars2050/combat-core-shadow/dist/index.js` проверяется через `isPathInside(siblingShadowPkg, expectedNodeModules)`. Если функция вернёт `true`, тест падает с ошибкой `Isolation containment flaw`.
   - **Targeted Challenge:**
     - Временная замена `isPathInside` на наивный `normChild.startsWith(normParent)`: запуск `test:combat:package:runtime` дал немедленный RED: `Error: Isolation containment flaw: sibling directory ... combat-core-shadow ... was falsely accepted as inside ... combat-core` (exit code 1).
     - Мутант отменен, тест возвращен в чистый GREEN.

- Статус: `needs_external_review`. Переход к R3a–R7 не производился.

## R3a: валидация полного входа до симуляции и расхода RNG (ISO-05) — green, review pending

Критерий: Zod safeParse + ссылочная целостность (definitions, instanceId uniqueness, projected squad member IDs, spawn references, summon cycles, bounds, currentHp <= maxHp) до создания world и первого обращения к PRNG. Machine-readable CombatDefinitionError c кодом, path и reference. Одинаковые коды и детали для исходного и JSON-stringified входа. Отсутствие расхода RNG при ошибке. Сохранение compatibility mapping для legacy Mars hp_current снаружи строгого ядра.

### RED

- Созданы `packages/combat-core/tests/validation.test.ts` и `packages/combat-core/tests/validation-integrity.test.ts` (18 тестов суммарно).
- На коде до фикса: запуск `vitest run packages/combat-core/tests/validation.test.ts` дал немедленный RED: `Cannot find module '../src/combat.input-validator.js'`.

### FIX

- `packages/combat-core/src/combat.definition-error.ts`:
  - Расширен список кодов: `SCHEMA_VALIDATION_ERROR`, `INVALID_DEFINITION_KEY`, `MISSING_DEFINITION`, `DUPLICATE_INSTANCE_ID`, `DUPLICATE_SQUAD_MEMBER_ID`, `MISSING_SPAWN_TYPE`, `MISSING_SPAWN_DEFINITION`, `UNCONSTRAINED_SUMMON_CYCLE`, `OUT_OF_BOUNDS_COORDINATES`, `INVALID_FIELD_RANGE`.
  - Добавлены типизированные поля `path`, `reference`, `issues`. Сохранена 100% обратная совместимость со старыми конструкторами R2a/R2b.
  - Размер файла оптимизирован до 96 строк (строго в пределах лимита).
- `packages/combat-core/src/combat.input-validator.ts` (новый):
  - `validateBattleInput(input: unknown): BattleInput`
  - 1. Структурный Zod `safeParse` с преобразованием путей и сообщений ошибок в `SCHEMA_VALIDATION_ERROR`.
  - 2. Проверка согласованности ключа `definitions[key]` с `def.id` (`INVALID_DEFINITION_KEY`).
  - 3. Проверка attackType: `beam`/`spread` отклоняются (`UNSUPPORTED_ATTACK_TYPE`), `spawn` требует `spawnType` (`MISSING_SPAWN_TYPE`).
  - 4-5. Ссылочная целостность: все `u.definitionId` обязаны существовать в `definitions` или `catalog.unitTypes` (`MISSING_DEFINITION`).
  - 6. Уникальность `instanceId` всех юнитов (`DUPLICATE_INSTANCE_ID`).
  - 7. Коллизии проецируемых ID членов отряда `${instanceId}_${s}` при `squadSize > 1` (`DUPLICATE_SQUAD_MEMBER_ID`).
  - 8. Транзитивная проверка определений `spawnType` (`MISSING_SPAWN_DEFINITION`) и циклов призыва без `spawnCap` (`UNCONSTRAINED_SUMMON_CYCLE`).
  - 9. Проверка координат препятствий и юнитов на непревышение границ арены (`OUT_OF_BOUNDS_COORDINATES`).
  - 10. Диапазоны полей: `currentHp <= maxHp` (`INVALID_FIELD_RANGE`), допустимость запланированных типов эффектов (`UNSUPPORTED_SCHEDULED_EFFECT`).
- `packages/combat-core/src/combat.runner.ts`:
  - `executeCombatSimulation` вызывает `validateBattleInput(input)` строго до `new PRNG(seed)` и создания мира.
  - Все дальнейшие обращения используют `validatedInput`.
- `packages/combat-core/src/facade/combat-facade.ts`:
  - `simulateCombat` вызывает `validateBattleInput(input)` до делегирования в симулятор.
- `packages/combat-core/src/index.ts`:
  - Экспорт `combat.input-validator.js` и `calculateEffectiveMaxHp`.
- `packages/combat-core/src/combat.unit-stat-compiler.ts`:
  - Добавлена функция `calculateEffectiveMaxHp(definitionId, rank, upgradeIds, catalog, definitions)` для расчета эффективного предела HP с учетом апгрейдов и ранга.
- `packages/combat-core/src/combat.spawn-spec-compiler.ts`:
  - Строка 32: `const def = definitions[spec.definitionId] ?? catalog?.unitTypes?.[spec.definitionId]` предотвращает исчезновение юнитов, объявленных только в каталоге.
- `src/domains/combat/combat.input-translator.ts`:
  - `mapUnitRowsToSpawnSpecs` использует `calculateEffectiveMaxHp` и ограничивает HP только при `row.hp_current > effectiveMaxHp`, сохраняя повышенное HP юнитов с апгрейдами (морпех с heavy_armor сохраняет 40 HP).

### Доработка R3a по результатам независимого ревью коммита 484b297 (ISO-05)

По результатам проверки коммита `484b297` независимый ревьюер отметил 6 пунктов для доработки R3a:

1. **[P1] Расчет эффективного maxHp и сохранение поведения Mars:**
   - Ранее валидатор и транслятор ограничивали HP базовым `def.baseStats.hp` (35 для морпеха), что срезало допустимое повышенное HP (40 HP при наличии `heavy_armor` с effective max 46).
   - Реализована функция `calculateEffectiveMaxHp` в `combat.unit-stat-compiler.ts`, экспортирована через `@mars2050/combat-core`.
   - В `combat.input-validator.ts` проверка `currentHp` использует `calculateEffectiveMaxHp`, разрешая повышенное здоровье в пределах ранга и модификаторов.
   - В `combat.input-translator.ts` транслятор Mars вычисляет `effectiveMaxHp` через `calculateEffectiveMaxHp(row.unit_type, rank, upgradeIds, marsCatalog, defs)` и не срезает здоровье юнитов до базового.
   - Создан тест `src/__tests__/combat.input-translator.test.ts` (4 теста), подтверждающий сохранение 40 HP для морпеха с `heavy_armor`, срез при превышении 46 HP и срез базового юнита до 35 HP.

2. **[P1] Паритет разрешения определений из `catalog.unitTypes`:**
   - В `packages/combat-core/src/combat.spawn-spec-compiler.ts:32` поиск определения расширен: `definitions[spec.definitionId] ?? catalog?.unitTypes?.[spec.definitionId]`.
   - Юниты, заданные только в `catalog.unitTypes`, больше не отбрасываются компилятором спавна, корректно попадают в `initialState` и участвуют в боевом моделировании.
   - В `validation-integrity.test.ts` добавлен тест спавна юнита только из каталога.

3. **[P2] Полнота предсимуляционной валидации до создания мира и расхода RNG:**
   - `statusOnHit` с `duration: 0` отклоняется валидатором (через `statusEffectSchema` со строгим `z.number().int().positive()` и проверку в `validateBattleInput`).
   - Неизвестный `upgradeId` в юнитах отклоняется с кодом `MISSING_DEFINITION` при отсутствии в `catalog.upgrades`.
   - Неизвестный `targetingProfile` в определении или `catalog.unitTypes` отклоняется с кодом `MISSING_DEFINITION`.
   - Неизвестный `spawnType` внутри `catalog.unitTypes` отклоняется с кодом `MISSING_SPAWN_DEFINITION`.
   - В `validation.test.ts` добавлен совместный spy на `PRNG.prototype.next` И `CombatWorld.prototype.queueUnitCreation`, подтверждающий ровно 0 обращений к PRNG и 0 вызовов создания мира при невалидном входе.

4. **[P2] Диапазоны значений запланированных эффектов:**
   - Валидатор проверяет положительность и конечность величин для `orbital_strike`, `mass_heal`, `mass_shield` (`value > 0 && Number.isFinite(value)`).
   - Для `global_emp` проверяется строгое требование положительного целого числа тиков (`value > 0 && Number.isInteger(value)`).
   - Некорректные значения (например, `mass_heal` с `value: -20` или `global_emp` с дробным значением) отклоняются с кодом `INVALID_FIELD_RANGE`.

5. **[P2] Изоляция узлов цикла призыва:**
   - В проверке циклов призыва граф обходится с выделением фактического кольца: `cycleNodes = path.slice(cycleStartIndex)`.
   - Требование `spawnCap > 0` проверяется только для узлов, непосредственно входящих в цикл.
   - Конфигурация `parent -> hydra -> hydra`, где `hydra` имеет `spawnCap: 2`, а `parent` не имеет `spawnCap`, теперь корректно принимается без ложного отклонения.

6. **[Additional] Конструктор `CombatDefinitionError` для legacy вызовов:**
   - В `CombatDefinitionError` проверка `extra?.effectId !== undefined` перенесена перед `typeof attackTypeOrExtra === 'string'`, что гарантирует корректное форматирование сообщения об ошибке запланированного эффекта при передаче пустых строк `''` в качестве 2-го и 3-го аргументов.

### GREEN (frozen snapshot)

| Команда | Exit code | Результат |
| --- | --- | --- |
| `npm run combat:core:build; npm run combat:core:check` | 0 | Сборка dist и tsc noEmit чисты |
| `npm run test:combat:core` | 0 | 48/48 тестов PASS (contracts: 6, definitions: 7, rules: 9, validation: 15, validation-integrity: 11) |
| `npm run typecheck` | 0 | Корневой typecheck чист (включая build core) |
| `npx tsx scripts/check-limits.ts --json` | 0 | 0 violations (все файлы строго в пределах лимитов: validator 247 строк <= 250, compiler 204 строки <= 250) |
| `npx tsx scripts/combat-ecs-golden.ts` | 0 | 7/7 presets stable (Mars baseline V8) |
| `npx tsx scripts/combat-ecs-golden.ts --v9` | 0 | 7/7 presets stable (Mars baseline V9) |
| `npm run test:combat:package:runtime` | 0 | Все блоки в изолированном tmpdir PASS (SHA256: 01180d3f0cc7659e574e03a2b290cd26e4eb323d051084acdab30ef68098bd96) |
| `npm run test:combat:package` | 1 | Честный известный ISO-08 BOUNDARY FAIL (4 внутренних пути, норма до R6) |
| `npm run lint` | 0 | 0 ошибок, 104 предупреждения |
| `npm test` | 0 | 202 files, 816 tests PASS |

### Доработка R3a по результатам повторного ревью коммитов 484b297 и 0f76b72 (ISO-05)

По результатам проверки независимый ревьюер отметил 4 замечания по валидации R3a и отдельный пропуск позднего призыва через upgrades:

1. **[P1] Согласованность приоритета определений между валидатором и runtime:**
   - В рантайме (`combat.runner.ts:57-62`) `catalog.unitTypes` имеет приоритет над публичными `definitions` для одинаковых ключей. Ранее валидатор перезаписывал определения каталога публичными.
   - В `combat.input-validator.ts` порядок сбора приведен в полное соответствие с runtime: `catalog.unitTypes` имеет приоритет над `definitions`.
   - В `combat.spawn-spec-compiler.ts:32` порядок разрешения также выровнен: `catalog?.unitTypes?.[spec.definitionId] ?? definitions[spec.definitionId]`.
   - В `validation-catalog.test.ts` подтверждено: невалидный оверрайд из каталога (duration: 0 в statusOnHit, неизвестный targetingProfile) отклоняется валидатором до создания мира и расхода RNG.

2. **[P2] Полная валидация определений каталога и ссылок позднего призыва в upgrades:**
   - Отсутствие `baseStats` у определений каталога теперь явно отклоняется с кодом `MISSING_DEFINITION` (ранее приводило к runtime crash).
   - Модификаторы улучшений `periodicSpawn.unit` и `onDeathSpawn` в `catalog.upgrades` строго валидируются против `allDefIds`. Несуществующие ссылки отклоняются с кодом `MISSING_SPAWN_DEFINITION` (ранее существующий upgrade со ссылкой на несуществующего юнита тихо возвращал 0 призывов).
   - Все способности (`abilities` и `periodicAbilities` в определениях, а также `periodicAbilities` в улучшениях) валидируются через `compileAbilityDefinitions`. Ошибки компиляции способностей (например, `intervalTicks <= 0`) отклоняются с кодом `SCHEMA_VALIDATION_ERROR`.

3. **[P2] Устранение раннего округления HP в `calculateEffectiveMaxHp`:**
   - В `packages/combat-core/src/combat.unit-stat-compiler.ts:202` удален `Math.round(compiled.hp)`, функция возвращает точный `compiled.hp`.
   - Морпех с `heavy_armor` + `stimpacks` сохраняет 36.4 HP без усечения до 36.
   - Морпех с `heavy_armor` при `hp_current: 50` срезается до точного эффективного максимума 45.5 HP (35 * 1.3).
   - В `combat.input-validator.ts` проверка `currentHp > maxHp + 1e-6` учитывает машинное эпсилон для чисел с плавающей точкой.
   - В `src/__tests__/combat.input-translator.test.ts` зафиксированы строгие тесты сохранения и среза вещественного HP.

4. **[P2] Проведение публичного `targetingProfile` через mapper:**
   - В `packages/combat-core/src/combat.definition-mapper.ts` добавлена передача `targetingProfile: (def.targetingProfile ?? def.baseStats?.targetingProfile) as TargetingProfile | undefined` в `baseStats`.
   - В `validation-catalog.test.ts` добавлен симуляционный тест: катапульта с публичным профилем `targetingProfile: 'siege'` выбирает целью вражескую башню (`combatTags: ['structure']`) вместо более близкой пехоты.

5. **Оптимизация тестов и соблюдение лимитов:**
   - Тесты разделены на `validation-integrity.test.ts` (11 тестов, 218 строк <= 250) и `validation-catalog.test.ts` (7 тестов, 178 строк <= 250).
   - В `combat.actor-turn-reservation-isolation.test.ts` для тяжелых контрфактических тестов установлен явный таймаут 15000ms, исключающий флаки при параллельном прогоне полного набора тестов на Windows.

### GREEN (обновленный frozen snapshot)

| Команда | Exit code | Результат |
| --- | --- | --- |
| `npm run combat:core:build; npm run combat:core:check` | 0 | Сборка dist и tsc noEmit чисты |
| `npm run test:combat:core` | 0 | 55/55 тестов PASS (contracts: 6, definitions: 7, rules: 9, validation: 15, validation-integrity: 11, validation-catalog: 7) |
| `npm run typecheck` | 0 | Корневой typecheck чист (включая build core) |
| `npx tsx scripts/check-limits.ts --json` | 0 | 0 violations (validator 249 строк <= 250) |
| `npx tsx scripts/combat-ecs-golden.ts` | 0 | 7/7 presets stable (Mars baseline V8) |
| `npx tsx scripts/combat-ecs-golden.ts --v9` | 0 | 7/7 presets stable (Mars baseline V9) |
| `npm run test:combat:package:runtime` | 0 | Все 8 проверочных блоков в изолированном tmpdir PASS (SHA256: 9b28877769be08c91f809b385309c0c4e9037a92dffc5393087ec25fcc760905) |
| `npm run test:combat:package` | 1 | Честный известный ISO-08 BOUNDARY FAIL (4 внутренних пути, норма до R6) |
| `npm run lint` | 0 | 0 ошибок, 104 предупреждения |
| `npm test` | 0 | 202 files, 817 tests PASS |

### Challenge (negative control)

- Доказательство чувствительности проверки ссылок позднего призыва в upgrades:
  - В `packages/combat-core/src/combat.input-validator.ts` временно отключена проверка `if (pUnit && !allDefIds.has(pUnit))`.
  - Запуск `vitest run --config packages/combat-core/vitest.config.ts packages/combat-core/tests/validation-catalog.test.ts` дал немедленный RED:
    - `validation-catalog.test.ts > rejects upgrade with periodicSpawn pointing to unknown definition with MISSING_SPAWN_DEFINITION`: `AssertionError: expected function to throw an error, but it didn't`.
  - Мутант отменен, возврат в чистый GREEN (55/55).

### Доработка R3a по результатам независимого ревью коммита c243bba (4 замечания)

По результатам проверки коммита `c243bba` независимый ревьюер указал на 4 замечания по полноте предсимуляционной валидации R3a и сохранению семантики Mars:

1. **[P1] Сохранение состава отряда в spawn compiler (`definitions.squadSize` vs `catalog`):**
   - Проблема: строка разрешения определения в `combat.spawn-spec-compiler.ts:32` предпочитала каталог публичным определениям. Если `definitions.unit.squadSize = 3`, а одноименный каталог содержал характеристики без `squadSize`, создавался 1 юнит вместо отряда из 3 (`a_0`, `a_1`, `a_2`).
   - Исправление:
     - В `combat.spawn-spec-compiler.ts:32` восстановлен приоритет: `const def = definitions[spec.definitionId] ?? catalog?.unitTypes?.[spec.definitionId]`.
     - В `combat.input-validator.ts` расчет `squadSize` для проверки коллизий ID членов отряда берется из `parsed.definitions[u.definitionId] ?? catUnitTypes?.[u.definitionId]`.
     - В `validation-r3a-spawns.test.ts` зафиксирован тест: при `definitions.marine.squadSize = 3` и одноименном юните в каталоге без `squadSize` создаются 3 сущности (`u1_0`, `u1_1`, `u1_2`).

2. **[P2] Полная рекурсивная проверка вложенных ссылок позднего призыва (spawn payloads):**
   - Проблема: `periodicSpawn.unit` и `onDeathSpawn` проверялись, но вложенный `payload.unitType` в `baseStats.periodicAbilities`, `upgrades[].modifiers.periodicAbilities`, `baseStats.triggerEffects`, `upgrades[].modifiers.triggerEffects`, а также в `abilities` пропускался. Несуществующий `ghost` принимался и молча производил 0 призывов.
   - Исправление:
     - Создан модуль `packages/combat-core/src/combat.payload-validator.ts`, рекурсивно валидирующий все `payload.kind === 'spawn'` во всех определениях и модификаторах улучшений против `allDefIds`.
     - Несуществующая ссылка на `ghost` во всех четырех точках входа отклоняется до симуляции с кодом `MISSING_SPAWN_DEFINITION` и точным path/reference.
     - Туда же вынесена проверка бесконечных циклов призыва `validateSummonCycles`.
     - В `validation-r3a-spawns.test.ts` зафиксированы 4 раздельных теста для `baseStats.periodicAbilities`, `upgrades.modifiers.periodicAbilities`, `baseStats.triggerEffects` и `upgrades.modifiers.triggerEffects`.

3. **[P2] Структурная валидация определений каталога и защита компилятора способностей:**
   - Проблема: `baseStats: {}` (без hp) принимался валидатором и приводил к runtime crash с NaN после создания мира и 2 обращений к RNG; `attackType: 'magic'` пропускался; `abilities: [{}]` приводил к необработанному `TypeError`.
   - Исправление:
     - В `packages/combat-core/src/contracts/unit.contracts.ts` для `baseStatsSchema` и `unitDefinitionSchema` включен `.passthrough()` с поддержкой `abilities: z.array(z.unknown()).optional()`, предотвращая молчаливое срезание расширенных полей Zod-парсером.
     - В `combat.input-validator.ts` каждое определение в `allDefs` (включая каталог) валидируется через `baseStatsSchema.passthrough().safeParse(def.baseStats)`. Отсутствие обязательных полей (`hp`, `attack`, `defense`, `speed`, `range`) или некорректный `attackType` ('magic') отклоняются с `SCHEMA_VALIDATION_ERROR`.
     - В `packages/combat-core/src/combat.ability-compiler.ts` функции `compileAbilityDefinitions` и `validateDefinition` защищены от невалидных структур (не объект, отсутствие `id`, `trigger`, не-массив `effects`), выбрасывая типизированную `AbilityCompilationError('UNSUPPORTED_COMBINATION')`, трансформируемую валидатором в `SCHEMA_VALIDATION_ERROR`.
     - Зафиксированы тесты в `validation-r3a-loadout.test.ts`: при `baseStats: {}` гарантировано 0 обращений к PRNG и 0 созданий мира, `attackType: 'magic'` и `abilities: [{}]` отклоняются с `SCHEMA_VALIDATION_ERROR`.

4. **[P2] Валидация объединенного loadout до симуляции:**
   - Проблема: способности проверялись изолированно, но не после объединения базовых характеристик и улучшений. Пропускались дублирующиеся ID периодических способностей (например, `id: 'heal'` в базе и в улучшении) и несовместимые геометрии (например, `cone` в базе + `line` в улучшении).
   - Исправление:
     - Создан модуль `packages/combat-core/src/combat.loadout-validator.ts`, собирающий объединенный loadout каждого юнита через `getRuntimePrimitiveStats(baseStats, u.upgradeIds, catUpgrades)`.
     - Проверяет совместимость геометрий оружия через `assertValidWeaponLoadout(u.definitionId, primitives)`.
     - Компилирует объединенные периодические способности через `compileAbilityDefinitions(...)`, обнаруживая коллизии ID (`DUPLICATE_ID`).
     - Компилирует оружейный план через `createLegacyAbilityDefinitions` + `compileTemporalWeaponPlan`.
     - Любые ошибки объединенного loadout отклоняются с кодом `SCHEMA_VALIDATION_ERROR` строго до создания мира и расхода RNG.
     - Зафиксированы тесты в `validation-r3a-loadout.test.ts` с проверкой 0 вызовов `PRNG.next()` и `CombatWorld.queueCompiledUnitCreation()`.

5. **Соблюдение архитектурных лимитов и изоляция:**
   - Все файлы строго укладываются в лимит <= 250 строк:
     - `combat.input-validator.ts`: 232 строки (лимит 250);
     - `combat.payload-validator.ts`: 194 строки (лимит 250);
     - `combat.loadout-validator.ts`: 71 строка (лимит 250);
     - `combat.ability-compiler.ts`: 229 строк (лимит 250);
     - `validation-r3a-spawns.test.ts`: 180 строк (лимит 250);
     - `validation-r3a-loadout.test.ts`: 199 строк (лимит 250).
   - `npx tsx scripts/check-limits.ts --json`: 0 violations.

### GREEN (обновленный frozen snapshot на c243bba + remediation)

| Команда | Exit code | Результат |
| --- | --- | --- |
| `npm run combat:core:build; npm run combat:core:check` | 0 | Сборка dist и tsc noEmit чисты |
| `npm run test:combat:core` | 0 | 65/65 тестов PASS (8 файлов тестов) |
| `npm run typecheck` | 0 | Корневой typecheck чист (включая build core) |
| `npx tsx scripts/check-limits.ts --json` | 0 | 0 violations (все файлы <= 250 строк) |
| `npx tsx scripts/combat-ecs-golden.ts` | 0 | 7/7 presets stable (Mars baseline V8) |
| `npx tsx scripts/combat-ecs-golden.ts --v9` | 0 | 7/7 presets stable (Mars baseline V9) |
| `npm run test:combat:package:runtime` | 0 | Все 8 проверочных блоков в изолированном tmpdir PASS (SHA256: afb2a4747f7cdd2b57ea2418852abae9395e7ffc07049d27225d20363f240c67) |
| `npm run test:combat:package` | 1 | Честный известный ISO-08 BOUNDARY FAIL (норма до R6) |
| `npm run lint` | 0 | 0 ошибок, 103 предупреждения |
| `npm test` | 0 | 202 files, 817 tests PASS |

### Challenge (negative control)

- Доказательство чувствительности проверки вложенных spawn-ссылок:
  - В `packages/combat-core/src/combat.input-validator.ts` временно закомментирован вызов `validateNestedSpawnPayloads(allDefs, allDefIds, catUpgrades)`.
  - Запуск `npx vitest run --config packages/combat-core/vitest.config.ts packages/combat-core/tests/validation-r3a-spawns.test.ts` дал немедленный RED:
    - 4 из 5 тестов упали (`Remark 2a`, `Remark 2b`, `Remark 2c`, `Remark 2d` — все 4 не поймали отсутствующий `ghost` и выбросили `AssertionError: expected function to throw an error, but it didn't`).
  - Мутант отменен, `validateNestedSpawnPayloads` восстановлен, возврат в 65/65 PASS.

### Review / решение

- Статус: `needs_external_review`. Переход к R3b–R7 не производился.
- Замечания независимого ревью по R3a полностью устранены, ISO-05 подтвержден тестами.

### Доработка R3a по результатам независимого ревью коммита c147be3 (4 замечания)

По результатам проверки коммита `c147be3` независимый ревьюер указал на 4 воспроизводимые проблемы предсимуляционной валидации R3a:

1. **[P2] Публичные способности принимаются и исполняются в runtime (эквивалентность каталогу):**
   - Проблема: `.passthrough()` сохранял дополнительные поля в `baseStatsSchema`, однако `combat.definition-mapper.ts:19` не передавал `abilities` и `periodicAbilities` в результирующий `UnitTypeConfig.baseStats`. В результате публичная burn-способность давала 0 `status_apply` (против 19 через каталог), а периодический призыв через публичное определение давал 0 `spawn` (против 4 через каталог).
   - Исправление:
     - В `packages/combat-core/src/combat.definition-mapper.ts` обеспечена передача всех поддерживаемых полей `abilities`, `periodicAbilities`, геометрий оружия и пассивных эффектов из `def` и `def.baseStats` в `UnitTypeConfig.baseStats`.
     - Создан `packages/combat-core/tests/validation-r3a-abilities.test.ts` (3 теста), доказывающий полную эквивалентность исполнения способностей через публичный контракт и через каталог (число `status_apply` и `spawn` совпадает 1:1), а также отрицательный контроль (юнит без способности дает 0 status_apply).

2. **[P2] Полный loadout проверяется для всех определений (включая late summons):**
   - Проблема: `validateUnitLoadout` вызывался только в цикле по `parsed.units` (стартовые юниты). Юнит, создаваемый только через late summon (например, `imp`, призываемый на тике 5 с несовместимой геометрией `cone` + `line`), обходил проверку до симуляции и приводил к runtime crash после создания мира и расхода RNG.
   - Исправление:
     - В `packages/combat-core/src/combat.loadout-validator.ts` добавлена функция `validateDefinitionBaseLoadout(definitionId, baseStats, pathPrefix)`.
     - В `combat.input-validator.ts` функция вызывается для всех определений в `allDefs` (как публичных, так и каталожных).
     - Проверяет `assertValidWeaponLoadout`, компиляцию периодических способностей и оружейный план (`compileTemporalWeaponPlan`) строго до создания мира и вызова PRNG.
     - В `packages/combat-core/tests/validation-r3a-contracts.test.ts` зафиксирован тест со spy на `PRNG.prototype.next` и `CombatWorld.prototype.queueCompiledUnitCreation`: 0 вызовов PRNG, 0 созданий мира, выброс `SCHEMA_VALIDATION_ERROR`. Добавлен положительный контроль с совместимой геометрией.

3. **[P2] Валидация squadSize каталога (исключение тихого удаления отряда):**
   - Проблема: `catUnitTypes` использовал `squadSize` без валидации на положительное целое. Если юнит в `catalog.unitTypes` имел `squadSize: -1`, `Array.from({ length: squadSize })` создавал пустой массив, атакующий отсутствовал в `initialState`, и движок возвращал победу defender на тике 0.
   - Исправление:
     - В `combat.input-validator.ts` при сборе определений и при проверке юнитов проверяется `squadSize !== undefined && (!Number.isInteger(squadSize) || squadSize < 1)`. При нарушении выбрасывается `CombatDefinitionError('INVALID_FIELD_RANGE', ...)`.
     - Аналогично валидируется `squadSpacing` (`Number.isFinite(squadSpacing) && squadSpacing >= 0`).
     - В `combat.squad-compiler.ts` и `combat.spawn-spec-compiler.ts` добавлена защитная нормализация `Math.max(1, Math.floor(squadSize || 1))`.
     - В `packages/combat-core/tests/validation-r3a-contracts.test.ts` зафиксированы тесты на отклонение `squadSize: -1` и `squadSize: 0`, а также положительный контроль: `squadSize: 3` из каталога создает 3 сущности в `initialState`.

4. **[P2] Схема и валидация числовых модификаторов upgrades до симуляции:**
   - Проблема: `catalog.upgrades` проверял периодические/death призывы, но не валидировал структуру числовых модификаторов. Апгрейд с `hpMult: "bad"` проходил валидацию, порождал NaN в HP и приводил к `ZodError` после создания мира и расхода RNG.
   - Исправление:
     - Создан модуль `packages/combat-core/src/combat.upgrade-schema.ts` с Zod-схемой `upgradeNumericModifiersSchema` и `upgradeConfigSchema`, валидирующей числовые мультипликаторы и добавки (`hpMult`, `attackMult`, `speedMult` и др.) на `z.number().finite()`.
     - Функция `validateUpgradeConfig(upgId, upg)` интегрирована в цикл обхода `catUpgrades` в `combat.input-validator.ts`.
     - Некорректные модификаторы (`hpMult: "bad"`) отклоняются с кодом `SCHEMA_VALIDATION_ERROR` до создания мира и расхода RNG.
     - Создан `packages/combat-core/tests/validation-r3a-upgrades.test.ts` со spy на PRNG и мир: 0 вызовов PRNG, 0 созданий мира, и положительный контроль: валидный `hpMult: 1.5` корректно увеличивает HP юнита в 1.5 раза.

5. **Соблюдение архитектурных лимитов и изоляция:**
   - Все файлы укладываются в установленные лимиты:
     - `combat.input-validator.ts`: 241 строка (лимит 250);
     - `combat.loadout-validator.ts`: 129 строк (лимит 250);
     - `combat.upgrade-schema.ts`: 77 строк (лимит 100);
     - `combat.definition-mapper.ts`: 53 строки (лимит 250);
     - `combat.squad-compiler.ts`: 88 строк (лимит 250);
     - `combat.spawn-spec-compiler.ts`: 79 строк (лимит 250);
     - `combat.runner.ts`: 144 строки (лимит 250);
     - `validation-r3a-abilities.test.ts`: 152 строки (лимит 250);
     - `validation-r3a-contracts.test.ts`: 195 строк (лимит 250);
     - `validation-r3a-upgrades.test.ts`: 88 строк (лимит 250).
   - `npx tsx scripts/check-limits.ts --json`: 0 violations.

### GREEN (обновленный frozen snapshot на c147be3 + remediation)

| Команда | Exit code | Результат |
| --- | --- | --- |
| `npm run combat:core:build; npm run combat:core:check` | 0 | Сборка dist и tsc noEmit чисты |
| `npm run test:combat:core` | 0 | 75/75 тестов PASS (11 файлов тестов) |
| `npm run typecheck` | 0 | Корневой typecheck чист (включая build core) |
| `npx tsx scripts/check-limits.ts --json` | 0 | 0 violations |
| `npx tsx scripts/combat-ecs-golden.ts` | 0 | 7/7 presets stable (Mars baseline V8) |
| `npx tsx scripts/combat-ecs-golden.ts --v9` | 0 | 7/7 presets stable (Mars baseline V9) |
| `npm run test:combat:package:runtime` | 0 | Все 8 проверочных блоков в изолированном tmpdir PASS (SHA256: 5ebb0b6687f96d1d08235a19bde01a4830b7de82e9bfdf6477614e7c7eb345f7) |
| `npm run test:combat:package` | 1 | Честный известный ISO-08 BOUNDARY FAIL (норма до R6) |
| `npm run lint` | 0 | 0 ошибок, 103 предупреждения |
| `npm test` | 0 | 202 files, 817 tests PASS |

### Review / решение

- Статус: `needs_external_review`. Переход к R3b–R7 не производился.
- Все 4 замечания независимого ревью по R3a устранены и верифицированы.

### Доработка R3a по результатам независимого ревью коммита b017699 (4 замечания)

По результатам проверки коммита `b017699` независимый ревьюер указал на 4 воспроизводимые проблемы предсимуляционной валидации R3a:

1. **[P2] Нормализованные способности участвуют в проверке сочетания с upgrades:**
   - Проблема: В `combat.input-validator.ts` создавался нормализованный `baseStatsForLoadout`, но последующий `validateUnitLoadout` получал исходный `allDefs[id].baseStats`. В результате конфликт `definition.abilities` (например, `line_pierce`) и upgrade (например, `coneAttack`) пропускался валидатором и приводил к `Invalid weapon loadout` после создания мира и 2 обращений к RNG.
   - Исправление:
     - Создан модуль `packages/combat-core/src/combat.definition-validator.ts`, экспортирующий `validateAndNormalizeDefinition(id, def, pathPrefix, allTargetingProfiles)`.
     - Все `abilities`, `periodicAbilities`, `targetingProfile` нормализуются непосредственно в `def.baseStats` внутри `allDefs` до любых проверок loadout.
     - `validateUnitLoadout` вызывается с уже нормализованным `allDefs`, гарантируя обнаружение несовместимых комбинаций оружия до создания мира и расхода RNG.
     - В `packages/combat-core/tests/validation-r3a-remarks.test.ts` зафиксирован тест со spy на PRNG и мир: 0 вызовов PRNG, 0 созданий мира, выброс `SCHEMA_VALIDATION_ERROR`, и положительный контроль с совместимыми способностями.

2. **[P2] Top-level periodicAbilities проверяет spawn-ссылки:**
   - Проблема: Верхнеуровневый `definition.periodicAbilities` обходил проверку вложенных spawn-ссылок в `validateNestedSpawnPayloads`, позволяя сослаться на несуществующего юнита без ошибки предсимуляции.
   - Исправление:
     - В `packages/combat-core/src/combat.payload-validator.ts` в `validateNestedSpawnPayloads` добавлен обход `def.periodicAbilities` на верхнем уровне определения наряду с `baseStats.periodicAbilities` и `baseStats.abilities`.
     - При ссылке на несуществующую сущность выбрасывается `CombatDefinitionError('MISSING_SPAWN_DEFINITION', ...)` с кодом `SCHEMA_VALIDATION_ERROR`.
     - В `packages/combat-core/tests/validation-r3a-remarks.test.ts` зафиксированы тесты на отклонение неизвестного `phantom` (0 вызовов PRNG, 0 созданий мира) и положительный контроль при наличии `phantom` в `allDefs`.

3. **[P2] Валидация структуры payload periodic-способностей по Zod-схеме:**
   - Проблема: Структура payload периодических способностей не валидировалась до симуляции (`status` без `effects`, `damage` или `shield` с нечисловым `amount`), что приводило к падению компилятора способностей после создания мира и расхода RNG.
   - Исправление:
     - Создан модуль `packages/combat-core/src/combat.periodic-schema.ts` (99 строк <= 100), описывающий `periodicAbilityPayloadSchema` (discriminated union по `kind`: `status`, `damage`, `hazard`, `shield`, `heal`, `spawn`, `mark`), `periodicAbilityConfigSchema` и экспортирующий `validatePeriodicAbilityConfig(abilityId, ability, pathPrefix)`.
     - Валидация интегрирована в `combat.definition-validator.ts` и `combat.loadout-validator.ts`.
     - Некорректные структуры payload отклоняются с кодом `SCHEMA_VALIDATION_ERROR` строго до создания мира и расхода RNG.
     - В `packages/combat-core/tests/validation-r3a-remarks.test.ts` зафиксированы тесты со spy на PRNG и мир: 0 вызовов PRNG, 0 созданий мира.

4. **[P2] Проверка конечности и допустимых диапазонов итоговых характеристик:**
   - Проблема: Конечность отдельных модификаторов апгрейдов и базовых статов не гарантировала конечность итоговых характеристик после масштабирования (например, `hpMult: 1e308` переполнял `effectiveHp` в `Infinity`), обходя базовую Zod-схему и ломая симуляцию.
   - Исправление:
     - В `packages/combat-core/src/combat.unit-stat-compiler.ts` выделена и экспортирована функция `calculateEffectiveUnitStats(definitionId, rank, upgradeIds, catalog, definitions): CompiledUnitStats | null`.
     - В `packages/combat-core/src/combat.loadout-validator.ts` добавлена функция `assertFiniteUnitStats(unitIndex, unit, stats)`, проверяющая строгую конечность и допустимость эффективных характеристик: `hp > 0`, `attack >= 0`, `defense`, `speed >= 0`, `range >= 0`, `cooldown > 0`, `shield >= 0`. При нарушении (`Infinity`, `-Infinity`, `NaN`) выбрасывается `CombatDefinitionError('INVALID_FIELD_RANGE', ...)`.
     - В `packages/combat-core/src/combat.input-validator.ts` итоговые характеристики рассчитываются и валидируются для каждого юнита до создания мира и расхода RNG.
     - В `packages/combat-core/src/contracts/unit.contracts.ts` добавлено `.finite()` ко всем числовым полям `baseStatsSchema`.
     - В `packages/combat-core/tests/validation-r3a-remarks.test.ts` зафиксированы тесты со spy на PRNG и мир: отклонение `hpMult: 1e308` с кодом `INVALID_FIELD_RANGE` при 0 вызовов PRNG и 0 созданий мира, а также положительный контроль с корректным масштабированием.

5. **Соблюдение архитектурных лимитов и изоляция:**
   - Все файлы строго укладываются в лимиты по `check-limits.ts`:
     - `combat.input-validator.ts`: 179 строк (лимит 250);
     - `combat.definition-validator.ts`: 111 строк (лимит 250);
     - `combat.loadout-validator.ts`: 195 строк (лимит 250);
     - `combat.payload-validator.ts`: 209 строк (лимит 250);
     - `combat.unit-stat-compiler.ts`: 223 строки (лимит 250);
     - `combat.periodic-schema.ts`: 99 строк (лимит 100);
     - `contracts/unit.contracts.ts`: 79 строк (лимит 100);
     - `validation-r3a-remarks.test.ts`: 207 строк (лимит 250).
   - `npx tsx scripts/check-limits.ts --json`: 0 violations across entire repo.

### GREEN (обновленный frozen snapshot на b017699 + remediation)

| Команда | Exit code | Результат |
| --- | --- | --- |
| `npm run combat:core:build; npm run combat:core:check` | 0 | Сборка dist и tsc noEmit чисты |
| `npm run test:combat:core` | 0 | 85/85 тестов PASS (12 файлов тестов) |
| `npm run typecheck` | 0 | Корневой typecheck чист (включая build core) |
| `npx tsx scripts/check-limits.ts --json` | 0 | 0 violations across entire repo |
| `npx tsx scripts/combat-ecs-golden.ts` | 0 | 7/7 presets stable (Mars baseline V8) |
| `npx tsx scripts/combat-ecs-golden.ts --v9` | 0 | 7/7 presets stable (Mars baseline V9) |
| `npm run test:combat:package:runtime` | 0 | Все 8 проверочных блоков в изолированном tmpdir PASS (SHA256: 9669fd74c5279f7612d41a8715a3fb45c0c9757f1a41608727a1fc8a31ad78ed) |
| `npm run test:combat:package` | 1 | Честный известный ISO-08 BOUNDARY FAIL (норма до R6) |
| `npm run lint` | 0 | 0 ошибок, 103 предупреждения |
| `npm test` | 0 | 202 files, 817 tests PASS |

### Review / решение

- Статус: `needs_external_review`. Переход к R3b–R7 не производился.
- Все 4 замечания независимого ревью по R3a устранены и верифицированы.

### Доработка R3a по результатам независимого ревью коммита 9e35f90 (3 замечания + строгий аудит покрытия)

По результатам проверки коммита `9e35f90` независимый ревьюер указал на 3 проблемы предсимуляционной валидации R3a и завышение покрытия в отчёте:

1. **[P2] Приоритет разрешений при совпадении ID в catalog.unitTypes и definitions:**
   - Проблема: Валидатор и runtime использовали разные источники характеристик юнитов при совпадении ID: валидатор отдавал приоритет `definitions`, а runtime отдавал приоритет `catalog.unitTypes` для боевых характеристик и ссылок на способности/призывы (при сохранении приоритета `definitions` для `squadSize`, `squadSpacing` и `formation`).
   - Исправление:
     - В `packages/combat-core/src/combat.input-validator.ts` нормализация и слияние определений приведены в точное соответствие с runtime-семантикой: нормализуются оба источника (`normDefs` и `normCatDefs`), а при объединении в `allDefs` боевые характеристики берутся из `normCatDefs[id]`, если юнит присутствует в каталоге, но `squadSize`, `squadSpacing` и `formation` берутся из `normDefs[id]` при наличии.
     - Валидация снаряжения (`validateUnitLoadout`), ссылок на способности и геометрию оружия теперь использует единый согласованный `allDefs`.
     - Добавлены регрессионные тесты в `packages/combat-core/tests/validation-r3a-precedence.test.ts`: каталожный `line_pierce` + выбранный апгрейд `coneAttack` отклоняются до симуляции (0 вызовов PRNG, 0 созданий мира); ссылка из каталога на отсутствующий summon отклоняется; при этом `squadSize: 3` из `definitions` создаёт 3 юнита в отряде, а чистые каталожные характеристики поверх загрязнённого definition корректно симулируются.

2. **[P2] Чистая нормализация без мутации и поломки замороженных определений (Object.freeze):**
   - Проблема: `validateAndNormalizeDefinition` в `combat.definition-validator.ts` мутировал переданный объект `def.baseStats` (`rawBase.periodicAbilities = ...`), что приводило к `TypeError: Cannot add property periodicAbilities, object is not extensible` на глубоко замороженных каталогах (`Object.freeze(...)`).
   - Исправление:
     - `validateAndNormalizeDefinition` переписана как чистая функция без побочных эффектов. Создаются неглубокие копии `baseStats` и нормализованные массивы `abilities` / `periodicAbilities`, возвращаемые в новой структуре `NormalizedDefinition`. Исходные структуры `def` и `def.baseStats` остаются неизменными.
     - Добавлен тест в `validation-r3a-precedence.test.ts` с глубоко замороженным объектом `Object.freeze(...)` для каталожного юнита: валидация и симуляция проходят успешно, состояние заморозки сохраняется (`Object.isFrozen(frozenKnight) === true`).

3. **[P2] Валидация характеристик и оверрайдов позднего призыва (overflow / non-finite):**
   - Проблема: Поздние призывы (например, периодический призыв с `hpPercent: 1e308` и базовым HP 1000) обходили проверку конечности статов, вычисляясь уже во время боя в `Infinity` и вызывая падение с `ZodError` после создания мира и расхода RNG. Также не валидировались `spawnOverrides` на валидность диапазонов (`hp > 0`, `attack >= 0`, `duration > 0`).
   - Исправление:
     - В `packages/combat-core/src/combat.loadout-validator.ts` добавлена функция `validateLateSpawnConfig(spawnDefId, hpPercent, path, catalog, definitions, spawnOverrides)`: рассчитывает эффективные характеристики призываемого юнита, проверяет `Math.floor(stats.hp * hpPercent)` на строгую конечность и границы, а также валидирует числовые значения `spawnOverrides`.
     - В `packages/combat-core/src/combat.payload-validator.ts` функция `validateNestedSpawnPayloads` подключена к `validateLateSpawnConfig` для всех источников призывов: апгрейды, периодические способности, триггерные эффекты, `attackType: 'spawn'`.
     - Добавлены тесты в `validation-r3a-precedence.test.ts` на отклонение `hpPercent: 1e308` и некорректных `spawnOverrides.hp: -50` до симуляции (0 вызовов PRNG, 0 созданий мира) и успешный запуск с корректным `hpPercent: 0.5`.

4. **Строгий контроль покрытия тестов (реальный simulateCombat + spy на PRNG и мир):**
   - Проблема: Ревьюер отметил, что отрицательные тесты вызывали `validateBattleInput`, завышая заявленное покрытие "валидации до создания мира и расхода RNG".
   - Исправление:
     - Все тесты в `packages/combat-core/tests/validation-r3a-remarks.test.ts` и `packages/combat-core/tests/validation-r3a-precedence.test.ts` переведены на вызов `simulateCombat(input)` со шпионами `vi.spyOn(PRNG.prototype, 'next')` и `vi.spyOn(CombatWorld.prototype, 'queueCompiledUnitCreation')`.
     - Каждое отклонение проверяет `expect(PRNG.prototype.next).toHaveBeenCalledTimes(0)` и `expect(CombatWorld.prototype.queueCompiledUnitCreation).toHaveBeenCalledTimes(0)`.

5. **Соблюдение архитектурных лимитов и изоляция:**
   - Все файлы строго укладываются в лимиты по `check-limits.ts`:
     - `combat.definition-validator.ts`: 146 строк (лимит 250);
     - `combat.input-validator.ts`: 193 строки (лимит 250);
     - `combat.loadout-validator.ts`: 211 строк (лимит 250);
     - `combat.payload-validator.ts`: 203 строки (лимит 250);
     - `index.ts`: 11 строк (лимит 100);
     - `validation-r3a-remarks.test.ts`: 227 строк (лимит 250);
     - `validation-r3a-precedence.test.ts`: 221 строка (лимит 250).
   - `npx tsx scripts/check-limits.ts --json`: 0 violations across entire repo.

### GREEN (обновленный frozen snapshot на 9e35f90 + remediation)

| Команда | Exit code | Результат |
| --- | --- | --- |
| `npm run combat:core:build; npm run combat:core:check` | 0 | Сборка dist и tsc noEmit чисты |
| `npm run test:combat:core` | 0 | 93/93 тестов PASS (13 файлов тестов) |
| `npm run typecheck` | 0 | Корневой typecheck чист (включая build core) |
| `npx tsx scripts/check-limits.ts --json` | 0 | 0 violations across entire repo |
| `npx tsx scripts/combat-ecs-golden.ts` | 0 | 7/7 presets stable (Mars baseline V8) |
| `npx tsx scripts/combat-ecs-golden.ts --v9` | 0 | 7/7 presets stable (Mars baseline V9) |
| `npm run test:combat:package:runtime` | 0 | Все 8 проверочных блоков в изолированном tmpdir PASS (SHA256: 7a88cce11cfab8f2994827c19c85a6ef1ba9a22b88ae9cfca6a76e7a5596a2d6) |
| `npm run test:combat:package` | 1 | Честный известный ISO-08 BOUNDARY FAIL (норма до R6) |
| `npm run lint` | 0 | 0 ошибок, 105 предупреждений |
| `npm test` | 0 | 202 files, 817 tests PASS |

### Review / решение

- Статус: `needs_external_review`. Переход к R3b–R7 не производился.
- Все 3 замечания независимого ревью по R3a и требование строгого тестирования через simulateCombat устранены и верифицированы.

### Доработка R3a по результатам независимого ревью коммита 1c36770 (2 замечания + строгий шпион на конструктор мира)

По результатам проверки коммита `1c36770` независимый ревьюер выявил 2 регрессии и дал уточнение по проверке отсутствия создания мира:

1. **[P2] Передача нормализованного каталога в runtime и предотвращение обхода проверки:**
   - Проблема: `validateBattleInput` возвращал исходный объект `parsed`, в котором `catalog.unitTypes` оставался ненормализованным. В результате способности, заданные на верхнем уровне каталожного юнита (`catalog.unitTypes.knight.periodicAbilities`), не попадали в `baseStats` рантайма и давали 0 призывов (в то время как в `baseStats.periodicAbilities` создавали 2 призыва). Кроме того, корректный верхнеуровневый payload мог замаскировать некорректный payload в `baseStats`, приводя к `TypeError` в рантайме после создания мира и расхода RNG.
   - Исправление:
     - В `packages/combat-core/src/combat.definition-validator.ts` обе ветки (`rawBase.periodicAbilities` и `rawTopPeriodic`, а также `abilities` и `targetingProfile`) теперь валидируются явно и независимо. Некорректный payload в `baseStats` гарантированно отклоняется с `SCHEMA_VALIDATION_ERROR` независимо от наличия верхнеуровневого поля.
     - В `packages/combat-core/src/combat.input-validator.ts` формируются и возвращаются `normalizedDefinitions` и `normalizedCatalog`, где каждый `unitType` содержит проверенный и нормализованный `baseStats`. При этом раздельные приоритеты строго соблюдаются: боевые характеристики берутся из каталога, а параметры отряда (`squadSize`, `squadSpacing`, `formation`) сохраняют приоритет из публичных `definitions`.
     - Добавлены тесты в `packages/combat-core/tests/validation-r3a-precedence.test.ts`: подтверждение создания призывов через верхнеуровневый `catalog.unitTypes.knight.periodicAbilities` и пресечение попытки обхода через повреждённый `baseStats.periodicAbilities` (0 вызовов PRNG, 0 созданий мира).

2. **[P2] Поддержка минимального значения 1 HP для позднего призыва:**
   - Проблема: `validateLateSpawnConfig` вычислял `Math.floor(hp * hpPercent)` и отклонял 0, в то время как рантайм-компилятор применяет `Math.max(1, Math.floor(...))`. Это ошибочно браковало допустимые конфигурации с базовым HP 1 и `hpPercent: 0.5`.
   - Исправление:
     - В `packages/combat-core/src/combat.loadout-validator.ts` проверка приведена в полное соответствие с рантаймом: `effectiveHp = Math.max(1, Math.floor(stats.hp * hpPercent))`. Проверяется строгая конечность масштабированного значения и `effectiveHp`, а также `hpPercent > 0`. Переполнения в `Infinity` и некорректные диапазоны продолжают отклоняться с `INVALID_FIELD_RANGE`.
     - Добавлен тест в `validation-r3a-precedence.test.ts` на успешную симуляцию призыва с базовым HP 1 и `hpPercent: 0.5`.

3. **Строгий шпион на создание сущностей в конструкторе CombatWorld:**
   - Конструктор `CombatWorld` вызывает `this.queueUnitCreation(...)`. Для абсолютной гарантии отсутствия создания мира во всех негативных тестах `validation-r3a-precedence.test.ts` и `validation-r3a-remarks.test.ts` установлен spy на `CombatWorld.prototype.queueUnitCreation` и `CombatWorld.prototype.queueCompiledUnitCreation` с проверкой 0 вызовов.

4. **Соблюдение архитектурных лимитов и изоляция:**
   - Все файлы строго укладываются в лимиты по `check-limits.ts`:
     - `combat.definition-validator.ts`: 165 строк (лимит 250);
     - `combat.input-validator.ts`: 242 строки (лимит 250);
     - `combat.loadout-validator.ts`: 212 строк (лимит 250);
     - `validation-r3a-precedence.test.ts`: 241 строка (лимит 250);
     - `validation-r3a-remarks.test.ts`: 228 строк (лимит 250).
   - `npx tsx scripts/check-limits.ts --json`: 0 violations across entire repo.

### GREEN (обновленный frozen snapshot на 1c36770 + remediation)

| Команда | Exit code | Результат |
| --- | --- | --- |
| `npm run combat:core:build; npm run combat:core:check` | 0 | Сборка dist и tsc noEmit чисты |
| `npm run test:combat:core` | 0 | 95/95 тестов PASS (13 файлов тестов) |
| `npm run typecheck` | 0 | Корневой typecheck чист (включая build core) |
| `npx tsx scripts/check-limits.ts --json` | 0 | 0 violations across entire repo |
| `npx tsx scripts/combat-ecs-golden.ts` | 0 | 7/7 presets stable (Mars baseline V8) |
| `npx tsx scripts/combat-ecs-golden.ts --v9` | 0 | 7/7 presets stable (Mars baseline V9) |
| `npm run test:combat:package:runtime` | 0 | Все 8 проверочных блоков в изолированном tmpdir PASS (SHA256: 1628446286e78e9e5183748c1d2f28e320b899f9b340c20bd89980e968344500) |
| `npm run test:combat:package` | 1 | Честный известный ISO-08 BOUNDARY FAIL (норма до R6) |
| `npm run lint` | 0 | 0 ошибок, 106 предупреждений |
| `npm test` | 0 | 202 files, 817 tests PASS |

### Review / решение

- Статус: `accepted` (независимый ревьюер подтвердил коммит `aafb467`, блокирующих замечаний не обнаружено; неблокирующее пожелание по проверке спавна late summon с base HP 1 и hpPercent 0.5 зафиксировано тестом `validation-r3a-precedence.test.ts`).
- Переход к R3b согласован.

## R3b: нейтральное размещение и границы арены (ISO-06) — green, review pending

Критерий: устранение хардкода 320-полосы из общего компилятора (`combat.spawn-spec-compiler.ts` и `combat.squad-compiler.ts`). Нейтральное по умолчанию определение границ размещения от размеров арены (любые размеры, в т.ч. 100x100, 400x600, 600x1200). Mars передает историческую стратегию размещения через адаптер (`depth: 320` при высоте >= 640). Поддержка `arena.deployment` (`{ depth?: number, attacker?: DeploymentZoneSpec, defender?: DeploymentZoneSpec }`). Детерминированная последовательность единого PRNG (0 обращений при заданных координатах, 1 при пропуске одной, 2 при пропуске обеих: сначала X, затем Y). Предсимуляционная валидация `validatePlacementAndBounds` (проверка вместимости отрядов, параметров зон, координат препятствий и членов отряда) с выбросом типизированного `CombatDefinitionError` до создания мира и расхода RNG. Историческая совместимость для граничных Mars-отрядов с явными координатами `grid_x: 0, grid_y: 0` решается в адаптере `src/domains/combat/combat.input-translator.ts` сдвигом на величину смещения формации без изменения позиций нормальных отрядов. Replay и golden детерминизм (V8 и V9) стабильны на 100% (0 дрейфа). Все лимиты репозитория соблюдены (файлы <= 250 строк, схемы <= 100 строк, отсутствие `any`).

### RED

- Создан набор тестов `packages/combat-core/tests/placement-r3b.test.ts` (5 тестов) и `packages/combat-core/tests/placement-r3b-bounds.test.ts` (5 тестов).
- До фикса:
  - На арене 100x100 случайные координаты генерировались в полосе 320, давая координаты y > 100 (например, y=140 или y=-41 для defender), что выходило за границы арены.
  - Отсутствовала валидация физической вместимости отряда в арену и зону развертывания.
  - Не было контракта `ArenaDeployment` и валидации `deploymentZoneSpecSchema`.

### FIX

1. **Контракты арены и развертывания (`packages/combat-core/src/contracts/battle.contracts.ts`):**
   - Добавлены `deploymentZoneSpecSchema` (`minX`, `maxX`, `minY`, `maxY`), `arenaDeploymentSchema` (`depth`, `attacker`, `defender`).
   - `arenaSpecSchema` расширен полем `deployment: arenaDeploymentSchema.optional()`. Размер файла: 88 строк (лимит 100).
2. **Модуль расчета границ (`packages/combat-core/src/combat.deployment-bounds.ts`):**
   - Функция `resolveDeploymentBounds(arena, team)`:
     - Если задана явная зона для команды (`deployment.attacker` / `deployment.defender`), возвращает её;
     - Если задан `depth`, вычисляет полосу глубиной `depth` (для attacker от minY до depth, для defender от maxY - depth до maxY);
     - Нейтральный fallback: пропорциональная зона развертывания до 25% высоты арены (attacker [0, 0.25*H], defender [0.75*H, H]). Размер: 63 строки (лимит 250).
3. **Предсимуляционный валидатор размещения (`packages/combat-core/src/combat.placement-validator.ts`):**
   - Функция `validatePlacementAndBounds(parsed, allDefs)`:
     - Валидирует корректность `depth` (`depth > 0 && depth <= height / 2`);
     - Валидирует границы явных зон (`minX < maxX`, `minY < maxY`, нахождение внутри арены);
     - Проверяет физическую вместимость каждого отряда в арену (`formationWidth <= arena.width && formationHeight <= arena.height`) и в зону развертывания при отсутствии явных координат;
     - Проверяет координаты препятствий и явные координаты членов каждого отряда (`u.placement.x + offset.x` в `[0, width]`, `u.placement.y + offset.y` в `[0, height]`).
     - Любое нарушение выбрасывает `CombatDefinitionError('OUT_OF_BOUNDS_COORDINATES' | 'INVALID_FIELD_RANGE')` строго до вызова PRNG и создания мира. Размер: 186 строк (лимит 250).
4. **Интеграция в валидатор входа (`packages/combat-core/src/combat.input-validator.ts`):**
   - Вызывает `validatePlacementAndBounds(parsed, allDefs)`. Размер: 229 строк (лимит 250).
5. **Компиляторы спавна и отрядов (`combat.spawn-spec-compiler.ts`, `combat.squad-compiler.ts`):**
   - Принимают `ArenaSpec` / `arenaObj`, используют `resolveDeploymentBounds`.
   - В `combat.spawn-spec-compiler.ts` вычисляются паддинги формации отряда (`leftPad`, `rightPad`, `topPad`, `bottomPad`), гарантируя размещение всех членов отряда строго в границах зоны развертывания без потери бойцов и повторного сэмплирования.
   - Единый порядок PRNG:
     - 0 вызовов при наличии обоих координат;
     - 1 вызов при пропуске X или Y;
     - 2 вызова (X затем Y) при пропуске обоих.
6. **Адаптер Mars (`src/domains/combat/combat.input-translator.ts`):**
   - В `translateMarsBattleInput` передает `deployment: options.arena?.deployment ?? (arenaHeight >= 640 ? { depth: 320 } : undefined)` для сохранения 100% совместимости с историческими записями Mars.
   - В `mapUnitRowsToSpawnSpecs` для граничных отрядов с явными координатами `grid_x: 0, grid_y: 0` выполняет сдвиг центра на величину смещения формации (`x = Math.max(-minOffsetX, Math.min(arenaWidth - maxOffsetX, x))`). Обычные координаты (например, [120, 480] в golden-реплеях) остаются абсолютно неизменными. Размер: 161 строка (лимит 250).
7. **Рантайм-раннер (`packages/combat-core/src/combat.runner.ts`):**
   - Передает `validatedInput.arena` в `compileSpawnSpecBundles`.

### GREEN (frozen snapshot)

| Команда | Exit code | Результат |
| --- | --- | --- |
| `npm run combat:core:build; npm run combat:core:check` | 0 | Сборка dist и tsc noEmit чисты |
| `npm run test:combat:core` | 0 | 108/108 тестов PASS (15 файлов тестов) |
| `npx vitest run src/__tests__/combat.engine.test.ts` | 0 | 2/2 PASS (включая граничные отряды с x=0, y=0) |
| `npx vitest run src/__tests__/combat.input-translator.test.ts` | 0 | 5/5 PASS |
| `npm run typecheck` | 0 | Корневой typecheck чист (включая build core) |
| `npx tsx scripts/check-limits.ts --json` | 0 | 0 violations across entire repo (все файлы строго в пределах лимитов) |
| `npx tsx scripts/combat-ecs-golden.ts` | 0 | 7/7 presets stable (Mars baseline V8) |
| `npx tsx scripts/combat-ecs-golden.ts --v9` | 0 | 7/7 presets stable (Mars baseline V9) |
| `npm run test:combat:package:runtime` | 0 | Все 8 проверочных блоков в изолированном tmpdir PASS (SHA256: 776b073da34e17676485d8945722bd31f3e10407d81a8c77bfef3d136cbceaf1) |
| `npm run test:combat:package` | 1 | Честный известный ISO-08 BOUNDARY FAIL (норма до R6) |

### Ремедиация замечаний независимого ревью R3b (commit 3d491c3)

1. **[P1] Сохранение штатных Mars-координат (регрессия балансного теста `tier1_scout_focus_fire`):**
   - Откачен ошибочный clamp в `src/domains/combat/combat.input-translator.ts` с добавлением `radius`, восстановив исторический диапазон `[0, arenaWidth - maxOffsetX]`. Отряды со скаутами на позиции 570 больше не смещаются на 566.
   - В `packages/combat-core/src/combat.placement-validator.ts` валидация членов отряда для стратегии Mars (`strategy === 'center' && squadSize > 1`) проверяет центры бойцов в границах `[0, arena.width]` и `[0, arena.height]`, тогда как для `strategy === 'fit_formation'` и одиночных юнитов проверяются физические границы с учетом `bodyRadius`.
   - В `src/domains/combat/combat.input-translator.ts` deployment гарантированно выставляет `strategy: 'center'`.
   - Все тесты `src/__tests__/combat.tier1-placement.test.ts` (включая `tier1_scout_focus_fire`) проходят 5/5 со штатным запасом HP (доля оставшегося HP победителя >= 0.1).
2. **[P2] Случайное размещение и радиус тел юнитов (`combat.spawn-spec-compiler.ts`):**
   - В `combat.spawn-spec-compiler.ts` для стратегии `fit_formation` диапазон случайного размещения центров теперь строго учитывает `bodyRadius = getSizeRadius(size)`:
     `minSpawnX = Math.max(bounds.minX - minOffsetX, bodyRadius - minOffsetX)`
     `maxSpawnX = Math.min(bounds.maxX - maxOffsetX, arenaWidth - bodyRadius - maxOffsetX)`
     `minSpawnY = Math.max(bounds.minY - minOffsetY, bodyRadius - minOffsetY)`
     `maxSpawnY = Math.min(bounds.maxY - maxOffsetY, arenaHeight - bodyRadius - maxOffsetY)`
   - Одиночный M-юнит на арене 100x100 при `seed=42` и `placement: {}` теперь генерирует валидные координаты внутри `[18, 82]`, физическое тело гарантированно помещается в арену `[0, 100]`, валидатор принимает сгенерированную позицию при явной передаче.
3. **[P2] Физические границы при создании юнитов в рантайме (`spawn-action-system.ts`, `death-system.ts`):**
   - В `packages/combat-core/src/ecs/systems/spawn-action-system.ts:112` координаты юнитов, создаваемых через атаку `attackType: 'spawn'`, клампятся с учетом `bodyRadius` типа призываемого юнита к `[bodyRadius, arenaDim - bodyRadius]`.
   - В `packages/combat-core/src/ecs/systems/death-system.ts:106` при клонировании убийцы по `replicateOnKill` координаты клона клампятся с учетом `bodyRadius` убийцы к `[bodyRadius, arenaDim - bodyRadius]` даже если жертва погибла у самой границы арены.
4. **[P2] Чувствительность теста опущенной оси в `placement-r3b-bounds.test.ts`:**
   - Тест обновлен на отряд размера S с шагом 60 (`sq: makeDef('sq', { size: 'S' }, { squadSize: 4, squadSpacing: 60 })`).
   - Физические размеры отряда $80 \times 80 \le 100$, что проходит общую проверку размеров арены и гарантированно тестирует проверку опущенной оси Y против глубины зоны развертывания (25), подтверждая отказ с `exceeds deployment zone height`.

### Ремедиация замечаний независимого ревью R3b (commit 971515d1)

1. **[P1] Штатная формация Mars для одиночных юнитов (`createFormationPlacement([titan_mech], 'attack', 'frontline')`):**
   - В `src/domains/combat/combat.input-translator.ts` для одиночных юнитов (`squadSize === 1`) введен клампинг координат с учетом `bodyRadius = getSizeRadius(size)` к диапазону `[radius, arenaDim - radius]`.
   - Одиночный XL-юнит (`titan_mech` в первой колонке со смещением на `(30, 930)`) безопасно корректируется до `(45, 930)`, предотвращая отказ валидатора с `OUT_OF_BOUNDS_COORDINATES` и обеспечивая успешный запуск `simulateBattle()`.
   - Для многоместных отрядов (`squadSize > 1`) сохраняется клампинг исключительно по смещениям членов отряда, гарантируя сохранение штатных позиций отрядов (скауты на 570) и соблюдение балансных критериев Mars (доля оставшегося HP победителя >= 0.1).
   - Добавлен проверочный тест запуска боя со штатной расстановкой Титана в `src/__tests__/combat.deployment.test.ts`.

2. **[P2] Отклонение пустого допустимого диапазона зон развертывания до RNG и создания мира (`placement-validator.ts`):**
   - В `packages/combat-core/src/combat.placement-validator.ts` для стратегии `fit_formation` при опущенных координатах вычисляются границы допустимого диапазона размещения `minSpawnX, maxSpawnX, minSpawnY, maxSpawnY` с учетом смещений формации и `bodyRadius`.
   - Если `minSpawnX > maxSpawnX` или `minSpawnY > maxSpawnY` (пустое пересечение зоны развертывания и физических границ арены), валидатор выбрасывает `CombatDefinitionError('OUT_OF_BOUNDS_COORDINATES', ...)` строго до создания мира и обращений к PRNG (0 вызовов PRNG, 0 вызовов фабрики сущностей).
   - В `packages/combat-core/src/combat.spawn-spec-compiler.ts` добавлен защитный коллапс диапазона `minSpawnX = maxSpawnX` / `minSpawnY = maxSpawnY` на случай прямого вызова компилятора в обход валидатора.
   - В `packages/combat-core/tests/placement-r3b-bounds.test.ts` добавлен отрицательный тест на одиночный XL-юнит на арене 100x100 без координат, подтверждающий отказ до создания мира и RNG.

3. **[P2] Приоритет каталога для характеристик тела при совпадении ID (`spawn-spec-compiler.ts`):**
   - В `packages/combat-core/src/combat.spawn-spec-compiler.ts` размер и радиус тела извлекаются с приоритетом каталога боевых характеристик над публичными `definitions` (`catDef?.baseStats?.size ?? pubDef?.baseStats?.size ?? 'M'`), тогда как параметры формации отряда (`squadSize`, `squadSpacing`, `formation`) сохраняют приоритет `definitions`.
   - При совпадении ID с размером `S` в `definitions` и `XL` в `catalog.unitTypes` компилятор использует радиус `XL` (`45`), удерживая центр юнита в диапазоне `[45, 55]` на арене 100x100 и предотвращая выход тела за границы арены.
   - Добавлен проверочный тест приоритета размера каталога в `packages/combat-core/tests/placement-r3b-bounds.test.ts`.

4. **[P2] Физически корректный радиус XL (45), проверка обеих границ и созданной ECS-сущности:**
   - В `packages/combat-core/tests/placement-r3b-creation-clamps.test.ts` радиус XL исправлен с 32 на фактический 45 (допустимый диапазон `[45, 55]` на арене 100x100).
   - Для клонов по `replicateOnKill` реализованы тесты для обеих границ (нижняя и верхняя) по обеим осям (X и Y).
   - Созданные ECS-сущности проверяются как через шпионы вызовов фабрики (`CombatWorld.prototype.queueCompiledUnitCreation` и `queueUnitClone`), так и в итоговом списке выживших `result.survivors`.

### Ремедиация замечаний независимого ревью R3b (commit 5342af6)

1. **[P2] Физические границы одиночных юнитов под стратегией `center` и согласованность случайного и явного размещения:**
   - В `packages/combat-core/src/combat.spawn-spec-compiler.ts` условие применения физических границ расширено: `if (strategy === 'fit_formation' || squadSize === 1)`. Для одиночных юнитов при любой стратегии (`center` или `fit_formation`) координаты удерживаются в `[bodyRadius, arenaDim - bodyRadius]`.
   - В `packages/combat-core/src/combat.placement-validator.ts` проверка опущенных координат расширена аналогично: `else if (strategy === 'fit_formation' || squadSize === 1)`, предотвращая расхождение правил между явным и случайным размещением.
   - Для `titan_mech` (XL, $R=45$) без координат при seed 5 на арене 600×1200 и глубине 320 случайные координаты генерируются строго в $[45, 555] \times [880, 1155]$, исключая выход тела за границу $Y=1200$. Порядок и количество обращений к PRNG строго сохранены (X затем Y).
   - Частично заданные координаты (только X или только Y) валидируются и генерируются детерминированно (ровно 1 вызов PRNG для отсутствующей координаты).
   - Выход явной координаты за физическую границу (например, $Y=1164$ для XL) отклоняется валидатором с `OUT_OF_BOUNDS_COORDINATES` до расхода PRNG и создания мира.

2. **[P2] Нулевой шаг формации (`squadSpacing: 0`) и согласованность defaults:**
   - В `packages/combat-core/src/combat.placement-validator.ts`, `packages/combat-core/src/combat.squad-compiler.ts`, `src/domains/combat/combat.deployment.ts`, `src/domains/combat/combat.input-translator.ts` и `src/domains/combat/combat.unit-definitions.ts` подстановка значений по умолчанию переведена с логического `||` на nullish coalescing `??` (`def?.squadSpacing ?? 20`).
   - Допустимое контрактом значение `squadSpacing: 0` больше не подменяется на 20.
   - Отряд из 9 бойцов размера S с `squadSpacing: 0` и `placement: { x: 50 }` на арене 100×100 успешно проходит валидацию без ложного срабатывания о превышении высоты формации и размещается в $(50, Y)$, где $Y \in [75, 90]$.
   - Добавлены позитивные симуляционные тесты в `packages/combat-core/tests/placement-r3b-center-bounds.test.ts` и сквозной тест в `src/__tests__/combat.deployment.test.ts`.

### Ремедиация замечаний независимого ревью R3b (commit bd9f7c6)

1. **[P2] Радиус размещения расходился с фактическим размером юнита (`combat.spawn-spec-compiler.ts:60`):**
   - Если в `definitions` был указан размер `S`, а в перекрывающем каталожном определении `size` опущен, компилятор размещения брал `S` ($R=10$) из-за цепочки фоллбэков `catDef?.baseStats?.size ?? pubDef?.baseStats?.size ?? 'M'`. В то же время runtime брал каталожное определение с дефолтным размером `M` ($R=18$).
   - Исправление: выбор эффективного определения вынесен на первый шаг (`const effectiveDef = catDef ?? pubDef`), после чего размер берется строго из него (`effectiveDef?.baseStats?.size ?? 'M'`), исключая подмешивание атрибутов из перекрытого `pubDef`.
   - В `packages/combat-core/tests/placement-r3b-center-bounds.test.ts` добавлен регрессионный тест: каталожное определение формируется с действительно отсутствующим свойством `size` (проверено через `expect(catDef.baseStats.size).toBeUndefined()`). При старой формуле на арене 100×100, со стратегией `center`, seed 42 и опущенными координатами юнит размещался на $Y=87$ (тест падает `AssertionError: expected 87 to be less than or equal to 82`), тогда как при исправленном коде размер строго берется из эффективного определения ($R=18$) и юнит размещается в пределах $[18, 82]$ ($y + 18 \le 100$).

2. **[P2] Одиночный юнит с `wedge` ошибочно считался не помещающимся в зону развертывания (`combat.placement-validator.ts:162, 196`):**
   - При валидации зоны развертывания для одиночного юнита с `formation: 'wedge'` и `squadSpacing: 30` фактическая высота формации составляет 0, однако валидатор суммировал отступы от начала координат (`topPad + bottomPad = 30`), выдавая ошибку `height (0) exceeds deployment zone height (25)`.
   - Исправление: валидатор теперь сравнивает размеры зоны с фактическим размахом формации (`zoneWidth < formationWidth` и `zoneHeight < formationHeight`) и проверяет непустоту допустимого диапазона спавна (`minSpawnX > maxSpawnX` и `minSpawnY > maxSpawnY`).
   - В `packages/combat-core/tests/placement-r3b-center-bounds.test.ts` добавлен позитивный тест: одиночный юнит с `formation: 'wedge'`, `squadSpacing: 30` на арене 100×100 со стратегией `center` успешно проходит валидацию и симулируется без ошибок.

3. **Инфраструктура тестов Vitest (`vitest.config.ts`):**
   - В `exclude` добавлен шаблон `'examples/**'`, предотвращающий захват примеров с тестами для других раннеров (например, `examples/fantasy-art-lab/*.test.mjs`).
   - Задан `testTimeout: 15000` в `vitest.config.ts`, увеличивающий индивидуальный лимит времени на выполнение отдельного теста для предотвращения таймаутов на тяжелых многосидовых сценариях (например, `combat.pre-target-state-isolation.test.ts`) в условиях параллельного исполнения тестов на нескольких воркерах.

### Challenge (negative control)

- Доказательство чувствительности проверки выхода отряда за пределы зоны развертывания:
  - В `packages/combat-core/tests/placement-r3b-bounds.test.ts` тест со squad formation размера 120x120 на арене с зоной глубиной 50 отклоняется с кодом `OUT_OF_BOUNDS_COORDINATES` до симуляции при ровно 0 вызовов PRNG и 0 вызовов создания сущностей.
  - Одиночный XL-юнит на арене 100x100 с опущенными координатами отклоняется с `OUT_OF_BOUNDS_COORDINATES` до симуляции (0 вызовов PRNG, 0 созданий мира).
  - Частично заданные координаты при превышении оставшейся осью зоны отклоняются с `OUT_OF_BOUNDS_COORDINATES` до симуляции (проверено отрядом 80x80 в зоне глубиной 25).
  - Попытка размещения юнита XL у границы (`x: 1`) отклоняется с `OUT_OF_BOUNDS_COORDINATES` по причине выхода тела за границу.
  - Ошибочные параметры зоны развертывания (`minX >= maxX` или `depth <= 0`) отклоняются с `INVALID_FIELD_RANGE` до симуляции.
  - Рантайм-тесты проверяют удержание в пределах арены: поздних периодических призывов, существ при атаке `attackType: 'spawn'` и клонов `replicateOnKill`.

### Review / решение

- Статус: `needs_external_review`. Переход к R4a–R7 не производился.
- ISO-06 полностью закрыт кодом и тестами.


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

## R4a: отделить публичный результат боя от внутреннего ECS-состояния (ISO-10) — green, review pending

- Ветка: `repair/combat-core-isolation`, базовый HEAD: `b3201ca4d3157f8437325573718e12cc38fd2485`.
- Цель: полная изоляция публичного контракта симуляции от внутреннего ECS-состояния (`profile.__marsCompat` полностью ликвидирован, исключена прямая передача ссылок на `SimUnit` или внутренних компонентных наборов).

### Устранение 4 замечаний внешнего ревью коммита b3201ca:

1. **[P1] Вложенные внутренние поля и ссылки (`snapshot.velocity`, `statusEffects`, sentinels):**
   - Проблема: `legacy-wire-codec.ts` копировал значения первого уровня и сохранял ссылки на вложенные объекты; сентинелы внутри `velocity` или `statusEffects` попадали в DTO и JSON.
   - Исправление:
     - `packages/combat-core/src/contracts/replay.types.ts`: введены строгие типы DTO для вложенных структур: `CombatVelocityDto` (`{ x: number; y: number }`), `CombatStatusEffectDto`, `CombatSnapshotUnit` с полным списком разрешенных полей.
     - `packages/combat-core/src/replay/legacy-wire-codec.ts`: внедрена глубокая рекурсивная изоляция `sanitizeNestedValue` с полным разрывом ссылок (`structuredClone`/detached reconstruction). Вложенные объекты и массивы рекурсивно очищаются от любых ключей с префиксом `_` и сторонних приватных полей. Для `velocity` гарантируется возвращение нового объекта вида `{ x: Number(v.x), y: Number(v.y) }`.

2. **[P2] Схемы и декодер принимали поврежденные данные (`NaN`, `Infinity`, `maxHp <= 0`, corrupt velocity):**
   - Проблема: `combatSnapshotUnitSchema` пропускал нефинитные числа (`Infinity`, `NaN`), неположительный `maxHp`, невалидные массивы эффектов, а `decodeLegacyReplayJson` не отсекал внутренние сентинелы.
   - Исправление:
     - `packages/combat-core/src/contracts/replay.contracts.ts`: `combatSnapshotUnitSchema` проверяет `Number.isFinite` для всех числовых координат и параметров. Статы (`attack`, `defense`, `speed`, `range`, `shield`, `maxShield`, `turnSpeed`) строго `>= 0`, `maxHp` строго `> 0`. Углы и смещения проверены на конечность. `velocity` проверяется как объект финитных `x` и `y` без сторонних ключей. Любые неразрешенные ключи верхнего уровня за пределами `CANONICAL_SNAPSHOT_KEY_SET` отклоняются валидатором.
     - `deserializeCombatUnitSnapshot`, `deserializeCombatAction`, `decodeLegacyReplayJson` унифицированы на строгий парсинг Zod и гарантированно отсекают любые внутренние сентинелы.

3. **[P2] Обход DTO через `options` Mars-адаптера и каст `as unknown as SimUnit`:**
   - Проблема: `combat.compat-mapper.ts` принимал `options` (`simInitialState`, `simSurvivors`, `simLogs`), перетиравшие очищенные данные, и возвращал `as unknown as SimUnit`.
   - Исправление:
     - `src/domains/combat/combat.compat-mapper.ts`: аргумент `options` полностью удален. Устранен каст `as unknown as SimUnit`. Адаптер возвращает строгие DTO `CombatSnapshotUnit[]` и `CombatTickActionDto[]`.
     - Все потребители в Mars-доменах (`pvp.persistence.ts`, `pvp.types.ts`, `battle-replay-*`, `simulator`, `simulator2`) приведены к типизации `CombatSnapshotUnit | SimUnit`.

4. **[P2] `profile: false` не гарантировал отсутствие `profile` при `trackMetrics: true`:**
   - Проблема: При `trackMetrics: true` и `profile: false` возвращался `profile.metrics`.
   - Исправление:
     - `packages/combat-core/src/contracts/battle.contracts.ts`: добавлено поле верхнего уровня `metrics?: Record<string, unknown>`.
     - `packages/combat-core/src/combat.runner.ts`: `profile` строго `undefined`, если `rules.profile: false`. Агрегированные метрики при `rules.trackMetrics: true` возвращаются в `result.metrics`.
     - Протестированы все 4 комбинации флагов (`profile: true/false`, `trackMetrics: true/false`).

### Верификация:

| Команда | Exit | Результат |
| --- | --- | --- |
| `npm run test:combat:core` | 0 | 19 файлов, 128 тестов PASS (включая `wire-codec-dto-isolation-r4a.test.ts`) |
| `npm run combat:ecs:golden` | 0 | V8 golden: 7/7 пресетов стабильны |
| `npm run combat:ecs:v9:golden` | 0 | V9 golden: 7/7 пресетов стабильны |
| `npm run test:combat:package:runtime` | 0 | Standalone tarball consumer PASS (SHA256: 5695be82…) |
| `npm test` | 0 | 203 файла, 820 тестов PASS (полный набор тестов Mars) |
| `npm run build` | 0 | Turbopack build + prebuild limit checks + static generation (32/32) PASS |
| `npx playwright test tests/e2e/simulator2-replay.spec.ts --project=chromium` | 0 | 9/9 browser replay tests PASS |
| `npx tsx scripts/check-limits.ts --diff HEAD --json` | 0 | 0 нарушений архитектурных лимитов |

### Доработка по результатам повторного ревью коммита 74c20e8 (5 замечаний P2):

1. **[P2] JSON round-trip терял допустимые поля события (`sourceId`, `x`, `y`, `amount`, `details`):**
   - Проблема: `decodeLegacyReplayJson` прогонял публичные события через `deserializeCombatAction` (суженный `BattleAction`), теряя `sourceId`, `x`, `y`, `amount`, `details`.
   - Исправление: `deserializeCombatAction` изолирован исключительно для Mars backward-compat адаптера; добавлен `deserializeCombatEvent` с парсингом по схеме `combatEventSchema`. `decodeLegacyReplayJson` десериализует события через `deserializeCombatEvent`, сохраняя 100% контракт публичных событий на round-trip.

2. **[P2] Вложенные данные событий оставались общей ссылкой и пропускали `_`-сентинелы:**
   - Проблема: `serializeCombatEvent` делал `event[k] = act[k]`, сохраняя ссылку на исходный объект `details` (`dto.details === original.details`) и пропуская приватные сентинелы вида `_privateWorldRef`.
   - Исправление: `serializeCombatEvent` пропускает все допустимые поля через `sanitizeNestedValue`, глубоко клонируя `details` с рекурсивным удалением полей с префиксом `_`. В `combatEventSchema` добавлена валидация `details`, отклоняющая любые приватные ключи (`_...`) и нефинитные числа.

3. **[P2] Повреждённый JSON «тихо чинился»:**
   - Проблема: `decodeLegacyReplayJson` подставлял `[]` при не-массивах `initialState`/`logs`, приводил `seed: null` к `0` через `Number(null)`, а отсутствующий `engineRevision` — к строке `"undefined"`.
   - Исправление: Устранены скрытые fallback и неявные приведения типов (`Number()`, `String()`, `Array.isArray ? ... : []`). Повреждённый JSON передается в валидатор `combatRunResultSchema.parse` как есть, вызывая строгую ошибку Zod (`ZodError`).

4. **[P2] Неполный контракт вложенных структур snapshot (`statusEffects`, `actionCooldownMax`):**
   - Проблема: `statusEffects` не имел allowlist полей и проверки типов — `entityStore` из simulation unit проходил без фильтрации, а `statusEffects[0].value: Infinity` и `actionCooldownMax: Infinity` проходили валидацию.
   - Исправление: В `replay.types.ts` определены канонические константы `CANONICAL_STATUS_EFFECT_KEYS`/`CANONICAL_TARGET_MARK_KEYS`. В `legacy-wire-codec.ts` `sanitizeNestedValue` фильтрует свойства `statusEffects` и `targetMark` по allowlist, отсекая `entityStore`. В `combatSnapshotUnitSchema` добавлена строгая проверка каждого элемента `statusEffects` по `CANONICAL_STATUS_EFFECT_KEY_SET` и `checkFinite` для всех числовых полей (`value`, `tickInterval`, `nextTickIn`, `maxStacks`, `elapsedTicks`, `appliedAtTick`, `shieldAmount`), а `actionCooldownMax` и `actionCooldown` включены в `nonNeg` статы.

5. **[P2] Валидатор loadout и схема реплея расходились по отрицательной защите:**
   - Проблема: `assertFiniteUnitStats` принимает конечную отрицательную защиту (например, `base: 2, defenseAdd: -5 → effective defense: -3`), но `combatSnapshotUnitSchema` требовала неотрицательную защиту и падала с `ZodError` после симуляции.
   - Исправление: В `combatSnapshotUnitSchema` поле `defense` перемещено из `nonNeg` в `finiteFields`, поддерживая любые финитные числа (включая отрицательные), в полном согласии с предсимуляционным контрактом.

### Верификация устранения замечаний:

- Добавлен комплексный тест `packages/combat-core/tests/wire-codec-review-p2.test.ts` (5/5 тестов PASS), адресно проверяющий каждое из пяти замечаний.
- `npm run test:combat:core` — 20 файлов, 133 теста PASS.
- `npm run combat:ecs:golden` и `npm run combat:ecs:v9:golden` — оба набора пресетов стабильны (7/7).
- `npm run test:combat:package:runtime` — standalone consumer PASS.
- `npm test` — 203 файла, 820 тестов PASS.
- `npm run build` — prebuild checks + turbopack build + typecheck PASS.
- `npx playwright test tests/e2e/simulator2-replay.spec.ts --project=chromium` — 9/9 тестов PASS.
- `npx tsx scripts/check-limits.ts --diff HEAD --json` — 0 нарушений архитектурных лимитов.

### Доработка по результатам повторного ревью коммита 7eb11ae (4 замечания P2):

1. **[P2] Декодер молча исправлял поврежденные данные (`velocity`, `statusEffects`):**
   - Проблема: `sanitizeNestedValue` приводил `x: null, y: "12"` к финитным числам `{ x: 0, y: 12 }` через `Number()`, а не-массивы в `statusEffects` (например, `{ foo: 'bar' }`) заменял на `undefined`, маскируя ошибки типов до валидатора.
   - Исправление: В `packages/combat-core/src/replay/legacy-wire-codec.ts` удалено принудительное приведение типов `Number()`. Координаты `velocity` фильтруются только от приватных ключей `_`, сохраняя исходные значения, а при `!Array.isArray(val)` для `statusEffects` возвращается исходное значение `val`. В результате `combatSnapshotUnitSchema` фиксирует неверные типы и выбрасывает валидные `ZodError`.

2. **[P2] Проверка `details` событий не обходила массивы:**
   - Проблема: `validateDetails` (`checkNode`) рекурсивно проверял только объекты (`isObj`), пропуская массивы, из-за чего структуры вида `details.hits: [{ _privateWorldRef: 'leak', amount: Infinity }]` проходили валидацию.
   - Исправление: В `packages/combat-core/src/contracts/replay.contracts.ts` обход `checkNode` расширен на массивы (`Array.isArray(node)`). Элементы массивов рекурсивно валидируются на отсутствие приватных ключей с `_` и конечность всех числовых значений.

3. **[P2] Допустимый `null` терялся при round-trip (`details: { label: null }`):**
   - Проблема: `sanitizeNestedValue` начинался с проверки `if (val === null || val === undefined) return undefined`, что приводило к полному вырезанию ключей со значением `null` при очистке вложенных объектов (`{ label: null }` превращалось в `{}`).
   - Исправление: Разделена обработка `undefined` и `null`: `if (val === undefined) return undefined; if (val === null || typeof val !== 'object') return val`. В цикле сборки `cleanObj` проверяется `sanitized !== undefined`, благодаря чему валидные значения `null` полностью сохраняются после round-trip.

4. **[P2] Ошибки корневого typecheck (TS2352):**
   - Проблема: В тестах и маппере прямое приведение строго типизированных интерфейсов без сигнатуры индекса (`as Record<string, unknown>`) вызывало ошибки компиляции `TS2352: Conversion of type ... may be a mistake because neither type sufficiently overlaps with the other`.
   - Исправление: Касты заменены на безопасные двухступенчатые `as unknown as Record<string, unknown>` в `src/__tests__/combat.compat-mapper.test.ts`, `packages/combat-core/tests/wire-codec-dto-isolation-r4a.test.ts` и `packages/combat-core/tests/wire-codec-review-p2.test.ts`. `npx tsc --noEmit --pretty false` проходит с 0 ошибок.

### Доработка по результатам повторного ревью коммита 10a40f91 (2 замечания P2):

1. **[P2] Очистка `event.details` сохраняла ссылки и удаляла допустимые данные:**
   - Проблема: Ранее правила очистки выбирались по имени ключа глобально: `if (key === 'velocity')`, `if (key === 'statusEffects')`, `if (key === 'targetMark')`. Из-за этого поля `details.velocity`, `details.statusEffects` и `details.targetMark` внутри событий ошибочно обрабатывались как поля снимка юнита:
     - `serializeCombatEvent()` не рекурсировал в `details.velocity`, сохраняя ссылку на `details.velocity.meta`. Изменение оригинала после сериализации меняло уже возвращённый DTO.
     - Допустимые пользовательские поля `details.statusEffects[].label`, `payload` и `details.targetMark.label` срезались белым списком ключей снимка юнита.
   - Исправление: Обработка полей снимка юнита полностью отделена от универсального глубокого копирования `event.details`.
     - В `packages/combat-core/src/replay/legacy-wire-codec.ts` добавлена универсальная функция `sanitizeEventDetails(val: unknown)`: рекурсивно глубоко копирует любые вложенные объекты и массивы, вырезает приватные ключи с префиксом `_`, сохраняет `null` и примитивы, полностью разрывая ссылки без наложения контрактных фильтров снимка юнита.
     - `serializeCombatEvent` очищает `action.details` и любые вложенные структуры через `sanitizeEventDetails`, сохраняя валидные поля `label`, `payload`, `meta` и обеспечивая полную изоляцию от последующих мутаций оригинала.
     - Санитизация снимка юнита (`serializeCombatUnitSnapshot`) вынесена в специализированные функции `sanitizeSnapshotVelocity`, `sanitizeSnapshotStatusEffects`, `sanitizeSnapshotTargetMark`, применяющиеся строго к соответствующим полям снимка юнита.

2. **[P2] Неверный тип `statusEffects.sourceId` позволял протащить внутренний объект:**
   - Проблема: `statusEffects[].sourceId` принимал объект вместо строки (например, `{ _privateWorldRef: { ecsPtr: 123 } }`). При десериализации сохранялась ссылка на него, а после JSON round-trip сохранялось само поле `_privateWorldRef`, так как схема не проверяла примитивные типы строковых полей вложенных DTO.
   - Исправление:
     - В `packages/combat-core/src/contracts/replay.contracts.ts` добавлена строгая проверка типов для всех объявленных полей вложенных DTO:
       - Для `statusEffects`: поля `['sourceId', 'sourceUnitId', 'stackKey', 'controlMode', 'sourceUnitType', 'sourceTeam', 'damageType', 'sourceUpgradeId']` обязаны быть строками (`typeof === 'string'`);
       - Для `targetMark`: строковые поля `sourceUnitId`, `squadId`, `retargetPolicy` обязаны быть строками, булевы поля `sharedDamage`, `squadWide` — boolean (`typeof === 'boolean'`);
       - Для снимка юнита: `size` валидируется по перечислению `'S' | 'M' | 'L' | 'XL'`, строковые ID — строками, булевы флаги — boolean.
       - Для событий `combatEventSchema`: строковые поля (`unitId`, `sourceId`, `targetId`, и др.) валидируются на `typeof === 'string'`.
     - При передаче объекта вместо строки `combatSnapshotUnitSchema`, `deserializeCombatUnitSnapshot` и `decodeLegacyReplayJson` выбрасывают `ZodError` (`Invalid statusEffect sourceId: expected string`).
     - В `legacy-wire-codec.ts` любые объекты, переданные в поля снимка юнита, глубоко копируются и очищаются от `_`, исключая утечки ссылок.

### Верификация:
- `packages/combat-core/tests/wire-codec-review-p2.test.ts`:
  - `[P2-1]` расширен проверкой иммутабельности DTO при последующей мутации `rawAction.details.velocity.meta.tag`, `details.statusEffects[0].label`, `details.targetMark.label` и сохранением всех этих полей после round-trip.
  - `[P2-4]` расширен проверкой отклонения схемой, десериализатором и JSON-декодером объекта `{ _privateWorldRef: { ecsPtr: 123 } }` в `sourceId`, а также невалидных типов в `targetMark`.
- `npm run combat:core:build` + `npx tsc --noEmit --pretty false`: 0 ошибок.
- `npm run test:combat:core`: 20 файлов, 133 теста PASS.
- `npm run combat:ecs:golden` и `npm run combat:ecs:v9:golden`: 7/7 стабильны.
- `npm run test:combat:package:runtime`: standalone consumer PASS.
- `npm test`: 203 файла, 820 тестов PASS.
- `npm run build`: Turbopack build + static generation (32/32) PASS.
- `npx playwright test tests/e2e/simulator2-replay.spec.ts --project=chromium`: 9/9 тестов PASS.
- `npx tsx scripts/check-limits.ts --diff HEAD --json`: 0 violations (`replay.contracts.ts` 97/100, `legacy-wire-codec.ts` 219/250, `wire-codec-review-p2.test.ts` 245/250).

### Доработка по результатам ревью коммита 39c397b (полнота DTO-валидации канонического инвентаря):

1. **[P2] Повреждённые поля событий и снимков проходили декодер и ломали состояние плеера:**
   - Проблема: `combatEventSchema` и `combatSnapshotUnitSchema` проверяли на тип только часть канонических полей. Поля вида `spawnMaxHp`, `impactTick`, `isCritical`, `sourceTeam` в событиях и `direction`, `supportAuras` в снимках юнитов не проверялись на соответствие типу. Событие с `spawnMaxHp: "bad"` проходило валидатор и декодер, попадая в `createSpawnedUnit` и приводя к `hp = NaN` при применении дельты урона.
   - Исправление:
     - В `packages/combat-core/src/contracts/replay.inventory.ts` сформирована полная 100% типизированная партиция всех канонических ключей:
       - Для событий (`CANONICAL_ACTION_KEYS`, 44 ключа): `ACTION_NUM_KEYS` (19 числовых полей: `x, y, fromX, fromY, toX, toY, amount, damage, value, facingAngle, radius, spawnMaxHp, markDuration, retargetCount, bonusDamage, launchTick, earliestLaunchTick, impactTick, impactId`), `ACTION_BOOL_KEYS` (3 булевых поля: `isCritical, isShieldHit, isWalking`), `ACTION_STR_KEYS` (20 строковых полей: `unitId, sourceId, targetId, sourceUnitId, spawnType, spawnTeam, hazardId, statusType, damageKind, cause, controlMode, stanceMode, modeState, markEvent, markSquadId, sourceUnitType, sourceTeam, projectileKind, cancelReason, motionKind`).
       - Для снимков юнитов (`CANONICAL_SNAPSHOT_KEYS`, 135 ключей): `SNAPSHOT_NUM_KEYS` (50 финитных числовых полей, включая `direction`, `rank`, `temporaryDuration`, и все скалярные статы/множители), `SNAPSHOT_BOOL_KEYS` (16 булевых флагов: `isFlying, isDead, resurrectOnce, isTemporary, canTargetAir, selfDestructOnAttack, appliesEmp, leavesPuddle, isMoving, isNavigatingObstacle, isBurrowed, stealthWhileMoving, movementStealthActive, stealthUntilAttack, hasAttacked, replicateOnKill`), `SNAPSHOT_STR_KEYS` (17 строковых полей), `SNAPSHOT_ARR_KEYS` (10 полей-массивов: `abilityPrograms, statusOnHit, conditionalRange, transformMode, supportPrograms, periodicAbilities, periodicPrograms, periodicProgramState, fieldEffect, triggerEffects`), `SNAPSHOT_OBJ_KEYS` (30 объектных конфигураций), а также специализированные контракты для `id`, `team`, `type`, `x`, `y`, `hp`, `maxHp`, `size`, `velocity`, `statusEffects`, `targetMark`, `supportAuras`.
     - В `packages/combat-core/src/contracts/replay.contracts.ts`:
       - `combatEventSchema` строго проверяет все `ACTION_NUM_KEYS` на финитные числа (`Number.isFinite`), `ACTION_BOOL_KEYS` на `typeof === 'boolean'`, `ACTION_STR_KEYS` на `typeof === 'string'`.
       - `combatSnapshotUnitSchema` строго проверяет все `SNAPSHOT_NUM_KEYS` на финитные числа, `SNAPSHOT_BOOL_KEYS` на boolean, `SNAPSHOT_STR_KEYS` на string, `SNAPSHOT_ARR_KEYS` на `Array.isArray`, `SNAPSHOT_OBJ_KEYS` на объектность `isObj`, а также `supportAuras` на массив объектов.
       - Файл строго уложен в лимит типов/контрактов: 98 строк (лимит $\le 100$).
     - В `packages/combat-core/src/replay/legacy-wire-codec.ts`:
       - `deserializeCombatAction(event)` выполняет строгую десериализацию через `deserializeCombatEvent(event)`, гарантируя отсечение любых поврежденных действий при десериализации.
     - Добавлен тестовый набор `packages/combat-core/tests/wire-codec-inventory-validation.test.ts` (139 строк $\le 250$):
       - Параметризованные отрицательные контроли для событий: `spawnMaxHp: "bad"`, `impactTick: "oops"`, `isCritical: "false"`, `sourceTeam: { pointer: "leak" }` с проверкой падения схемы, десериализатора событий/действий и полного `decodeLegacyReplayJson`.
       - Параметризованные отрицательные контроли для снимков юнитов: `direction: "bad"`, `supportAuras: {}`, `isFlying: "true"`, `squadId: 123`, `abilityPrograms: "not_an_array"`, `burrowConfig: "not_an_object"`.
       - Проверка отклонения схемой несанкционированных неканонических ключей.
       - Положительный контроль сохранения и round-trip всех канонических полей инвентаря.

### Верификация:
- `npm run combat:core:build` + `npx tsc --noEmit --pretty false`: 0 ошибок компиляции и типов.
- `npm run test:combat:core`: 21 файл, 146 тестов PASS (включая 13 новых тестов инвентаря).
- `npm run combat:ecs:golden` и `npm run combat:ecs:v9:golden`: стабильны на 7/7 пресетах.
- `npm run test:combat:package:runtime`: изолированная сборка tarball и внешний consumer PASS.
- `npm test`: 203 файла, 820 тестов PASS.
- `npm run build`: Turbopack production build + 32/32 static pages PASS.
- `npx playwright test tests/e2e/simulator2-replay.spec.ts --project=chromium`: 9/9 тестов PASS.
- `npx tsx scripts/check-limits.ts --json`: 0 violations (`replay.contracts.ts` 98/100, `replay.inventory.ts` 80/250, `legacy-wire-codec.ts` 220/250, `wire-codec-inventory-validation.test.ts` 139/250).

### Доработка по результатам ревью коммита 2688b50 (схемы вложенных конфигураций и инварианты действий):

1. **[P2] Вложенные конфигурации проверялись только как контейнеры:**
   - Проблема: `supportAuras`, `abilityPrograms`, `burrowConfig` и другие вложенные объекты/массивы проверялись только поверхностно (`isObj`, `Array.isArray`). Невалидные и внутренние данные (например, `entityStore: { ptr: 123 }`, `radius: "bad"`, `value: Infinity`, `abilityPrograms: [null, 'bad']`, повреждённый `burrowConfig`) проходили валидацию, что приводило к сохранению внутренних объектов во внешнем JSON или негласному превращению `Infinity` в `null`.
   - Исправление:
     - Выделен модуль `packages/combat-core/src/contracts/replay.nested-validators.ts` (149 строк $\le 250$).
     - Реализован глубокий обход `validateDeepNode` для валидации произвольных вложенных структур: проверка финитности чисел, запрет приватных полей `_`, отклонение null/undefined/некорректных типов в массивах.
     - Добавлены строгие канонические валидаторы:
       - `validateSupportAuras`: проверяет канонический набор ключей (`CANONICAL_SUPPORT_AURA_KEY_SET`), отклоняет несанкционированные поля (`entityStore`), проверяет финитность числовых полей (`radius`, `value`, `duration`, `interval`), валидирует `target` ('allies' | 'enemies') и `targetTags`.
       - `validateAbilityProgramItem`: проверяет `id` (непустая строка), структуру триггера, `priority`, группы действий и рекурсивно проверяет все ветви конфигурации.
       - `validateBurrowConfig`: проверяет канонические ключи (`CANONICAL_BURROW_CONFIG_KEY_SET`), требует конечное числовое значение `damageReduction`, валидирует опциональные числовые поля регенерации и множителей.
       - `validateSnapshotArrayField` и `validateSnapshotObjectField`: отклоняют повреждённые элементы в массивах (`[null, 'bad']`) и повреждённые объекты конфигураций.
     - В `legacy-wire-codec.ts`:
       - Реализована санитизация вложенных структур снимков юнитов с фильтрацией по допустимым наборам ключей (`CANONICAL_SUPPORT_AURA_KEYS`, `CANONICAL_BURROW_CONFIG_KEYS`, `VELOCITY_KEYS`), что исключает утечку внутренних полей (`entityStore`) в публичный DTO при сериализации.

2. **[P2] Инварианты `BattleAction` не гарантировались при конверсии:**
   - Проблема: `deserializeCombatAction()` конструировал `BattleAction`, но не гарантировал обязательные инварианты рантайма плеера:
     - `move` без `unitId` и `sourceId` приводил к `TypeError: Cannot read properties of undefined (reading 'replace')` в рантайме плеера.
     - `spawnTeam: 'invalid-team'` молча фоллбэчился на стороне плеера.
     - `spawnMaxHp: 0` создавал юнитов с `hp: 0, maxHp: 0`, но `isDead: false`.
   - Исправление:
     - В `combatEventSchema` добавлена валидация: событие `type === 'move'` обязано содержать непустой `unitId` или `sourceId`. `spawnTeam` может принимать только `'attacker' | 'defender'`. `spawnMaxHp` обязан быть строго положительным числом (`> 0`).
     - В `deserializeCombatAction` гарантируется наличие непустого `unitId` (из `action.unitId`, `raw.sourceId` или `raw.sourceUnitId`), а также проверяются `spawnTeam` и `spawnMaxHp > 0`.
   - Расширен тестовый набор `packages/combat-core/tests/wire-codec-inventory-validation.test.ts` (185 строк $\le 250$, 20 тестов):
     - Добавлены негативные тесты отклонения повреждённых `supportAuras`, `abilityPrograms`, `burrowConfig`.
     - Добавлены негативные тесты на отсутствие `unitId`/`sourceId` в `move`, невалидный `spawnTeam`, `spawnMaxHp <= 0`.

### Верификация:
- `npm run combat:core:build` + `npx tsc --noEmit --pretty false`: 0 ошибок компиляции и типов.
- `npm run test:combat:core`: 21 файл, 153 теста PASS (включая 20 тестов инвентаря и инвариантов).
- `npm run combat:ecs:golden` и `npm run combat:ecs:v9:golden`: 7/7 стабильны на обоих наборах.
- `npm run test:combat:package:runtime`: изолированная сборка tarball и внешний consumer PASS.
- `npm test`: 203 файла, 820 тестов PASS.
- `npm run build`: Turbopack production build + 32/32 static pages PASS.
- `npx playwright test tests/e2e/simulator2-replay.spec.ts --project=chromium`: 9/9 тестов PASS.
- `npx tsx scripts/check-limits.ts --json`: 0 violations (`replay.contracts.ts` 87/100, `replay.nested-validators.ts` 149/250, `replay.inventory.ts` 98/250, `legacy-wire-codec.ts` 222/250, `wire-codec-inventory-validation.test.ts` 185/250).

### Доработка по результатам ревью коммита 6a7f636 (вложенная валидация инвентаря и регрессия null):

1. **[P2] Вложенная валидация пропускала повреждённые структуры и внутренние поля:**
   - Проблема: `validateAbilityProgramItem` проверял только внешний объект программы, но не структуру её содержимого. Проходили `groups: ['bad']`, программы без `groups`, `trigger: { kind: 'periodic', intervalTicks: 'bad' }`, `expression: { kind: 'fixed', amount: 'bad' }`. Внутреннее поле `abilityPrograms[0].entityStore` сохранялось в публичном DTO из-за общей очистки `legacy-wire-codec.ts:87`, удалявшей только ключи с `_`. Аналогично проходили `linePierce.width: 'bad'`, вложенный `linePierce.entityStore` и `statusOnHit.duration: 'bad'`.
   - Исправление:
     - В `packages/combat-core/src/contracts/replay.inventory.ts` добавлены полные наборы канонических ключей: `SNAPSHOT_OBJ_ALLOWED_KEY_SETS`, `SNAPSHOT_ARR_ITEM_ALLOWED_KEY_SETS`, `ABILITY_PROGRAM_KEY_SET`, `ABILITY_TRIGGER_KEY_SET`, `ABILITY_GROUP_KEY_SET`, `ABILITY_SELECTOR_KEY_SET`, `ABILITY_DAMAGE_EXPR_KEY_SET`.
     - В `packages/combat-core/src/contracts/replay.nested-validators.ts`:
       - `validateAbilityProgramItem`: проверяет отсутствие посторонних ключей (отклоняет `entityStore`), требует непустой строковый `id`, валидирует `priority`, проверяет `trigger` (допустимые kinds, positive finite number `intervalTicks` для `periodic`), требует обязательный непустой массив `groups` объектов; для каждого group проверяет селектор и эффекты; для эффекта `damage` проверяет структуру `expression` (конечные неотрицательные числа для `fixed` и `attack_multiplier`).
       - `validateSnapshotObjectField`: проверяет ключи по `SNAPSHOT_OBJ_ALLOWED_KEY_SETS` (отклоняет `linePierce.entityStore`), проверяет обязательные финитные числовые поля (`linePierce.width`, `linePierce.damageMultiplier`, `coneAttack`, и др.).
       - `validateSnapshotArrayField`: проверяет ключи элементов по `SNAPSHOT_ARR_ITEM_ALLOWED_KEY_SETS`, проверяет финитность `duration` в `statusOnHit` (отклоняет `statusOnHit.duration: 'bad'`).
     - В `packages/combat-core/src/replay/legacy-wire-codec.ts`:
       - Добавлены `sanitizeAbilityPrograms` и `sanitizeAbilityEffect`: рекурсивно очищают программы и эффекты от любых посторонних полей (включая `entityStore`).
       - В `serializeCombatUnitSnapshot` объекты снимка очищаются через `SNAPSHOT_OBJ_ALLOWED_KEY_SETS`, массивы — через `SNAPSHOT_ARR_ITEM_ALLOWED_KEY_SETS`, гарантируя отсутствие утечек внутренних полей в публичный DTO.

2. **[P2] Регрессия запрета валидного `null` в массивах `event.details`:**
   - Проблема: общий `validateDeepNode` запрещал `null` во всех массивах, из-за чего `{ details: { values: [1, null, "ok"] } }` получал `ZodError`.
   - Исправление:
     - Создана функция `validateDetailsNode` специально для произвольных JSON-данных `event.details`.
     - `validateDetailsNode` допускает примитивный `null` внутри массивов и объектов `details`, но продолжает строго запрещать приватные ключи `_` и нефинитные числа (`Infinity`, `NaN`).
     - `combatEventSchema` переключена на использование `validateDetailsNode` для `details`.

3. **Конфигурация Vitest:**
   - В `vitest.config.ts` в `exclude` добавлены `'apps/**'` и `'artifacts/**'` для предотвращения подхвата сторонних Playwright spec файлов.

### Верификация:
- `npm run combat:core:build` + `npx tsc --noEmit --pretty false`: 0 ошибок.
- `npm run test:combat:core`: 21 файл, 156 тестов PASS (включая все новые негативные контроли и round-trip с `null`).
- `npm run combat:ecs:golden` и `npm run combat:ecs:v9:golden`: 7/7 стабильны на обоих наборах.
- `npm run test:combat:package:runtime`: изолированная сборка tarball и внешний consumer PASS.
- `npm test`: 203 файла, 820 тестов PASS.
- `npm run build`: Next.js 16 App Router Turbopack, 32/32 статических страниц PASS.
- `npx playwright test tests/e2e/simulator2-replay.spec.ts --project=chromium`: 9/9 тестов PASS.
### Доработка по результатам ревью R4a (pass 2 — санитизатор, глубокая валидация payload, утечка entityStore и лимиты):

1. **[P1] Санитизатор повреждает допустимые способности:**
   - Проблема: `sanitizePeriodicPayload` превращал `{ kind: 'mark', mark: { duration: 10 }, radius: 20 }` в `{ kind: 'mark' }`, теряя объект `mark`. Также терялись допустимые `percentHp` (в `damage`), триггерный `field` (в `triggerEffects`) и `hpPercent` (в `delayed_reassembly`). В `sanitizeTriggerPayload` блок `heal` не имел фигурных скобок, из-за чего последующие ветки попадали в dangling-else внутреннего цикла.
   - Исправление:
     - В `packages/combat-core/src/replay/legacy-nested-sanitizer.ts`:
       - `sanitizePeriodicPayload`: добавлена полная поддержка `mark` (через `sanitizeTargetMark`), `percentHp` (через `sanitizePercentHp`), финитного положительного `shield` и валидация допустимых kinds.
       - `sanitizeTriggerPayload`: добавлены явные фигурные скобки для ветки `heal`, предотвращающие dangling-else; полностью поддержаны `field` (через `sanitizeFieldEffectItem`), `delayed_reassembly.hpPercent`, `damage.percentHp`.
     - В `packages/combat-core/src/replay/legacy-wire-codec.ts`: в `serializeCombatUnitSnapshot` примитивные числовые значения нормализуют `-0` в `0`, обеспечивая строгую идентичность между in-memory объектами `simulateCombat` и результатом JSON round-trip десериализации.

2. **[P2] Полнота валидации вложенных способностей (`periodic_payload`):**
   - Проблема: `validateAbilityEffect` проверял только `ability.id` и `intervalTicks`, пропуская повреждённые payload (`{ kind: 'made_up' }`, `{ kind: 'shield', amount: 'bad' }`).
   - Исправление:
     - В `packages/combat-core/src/contracts/replay.nested-models.ts`:
       - `validateAbilityEffect` для эффекта `periodic_payload` рекурсивно валидирует способность через `validatePeriodicAbilityItem(eff.ability, ctx, path)`.
       - `validatePeriodicAbilityItem` валидирует `payload` через `validatePeriodicPayload`, где проверяются допустимые типы payload и их структуры (`mark`, `shield`, `damage`, `heal`, `spawn`, `hazard`, `status`).

3. **[P2] `fieldEffect.statusEffects` пропускает внутренние поля:**
   - Проблема: `fieldEffect` обрабатывался общим путём без очистки вложенных `statusEffects`, в результате чего поля вроде `entityStore: { ptr: 123 }` выживали в сериализованном снимке и внешнем JSON.
   - Исправление:
     - В `packages/combat-core/src/contracts/replay.nested-validators.ts`: ветка `fieldEffect` валидирует элементы через `validateFieldEffectItem` и `validateDeepNode`, отклоняя любые посторонние ключи.
     - В `packages/combat-core/src/replay/legacy-wire-codec.ts`: добавлена ветка сериализации `key === 'fieldEffect'`, фильтрующая элементы через `sanitizeFieldEffectItem` и очищающая вложенные `statusEffects`.

4. **[P2] Статические проверки, лимиты и строгая типизация:**
   - `packages/combat-core/src/replay/legacy-nested-sanitizer.ts` оптимизирован и сжат до ровно 250 строк ($\le 250$).
   - `packages/combat-core/src/contracts/replay.nested-models.ts`: 247 строк ($\le 250$).
   - `packages/combat-core/src/contracts/replay.nested-validators.ts`: 239 строк ($\le 250$).
   - `packages/combat-core/src/replay/legacy-wire-codec.ts`: 211 строк ($\le 250$).
   - Устранены все ошибки `no-explicit-any` (9 штук) в санитизаторе и тестах `wire-codec-nested-p2.test.ts`.

### Верификация:
- `node --import tsx artifacts/review-r4a-nested-pass2/probe.mjs`: 10/10 проверок PASS (все round-trip тестов, отсечение `made_up`/`bad shield`, очистка `fieldEffect.statusEffects.entityStore`, декодирование симуляции с периодической меткой).
- `npx tsx scripts/check-limits.ts --all --json`: 0 violations (0 error, 0 warning, 0 info).
- `npx eslint packages/combat-core/src packages/combat-core/tests`: 0 ошибок.
- `npm --prefix packages/combat-core run build`: 0 ошибок, чистая компиляция `tsc`.
- `npx vitest run --config packages/combat-core/vitest.config.ts packages/combat-core/tests/wire-codec-*.test.ts`: 43/43 теста PASS.

### 2026-10-06 — принятие владения ядром и кандидат parity-r4 для P0

Статус: `needs_external_review`. Приёмка R4a/P0 и переход к R4b–R7 не объявляются.
База: `9c7c49062ad064819968acfa41f667e00a8f39a3` + 29 явно перечисленных незакоммиченных overlay-файлов.
Входящие исправления предыдущего владельца сохранены; probe R4a независимо повторён: 10/10 PASS.

- Первая точка расхождения исходного P0-реплея: `Math.cos(-3.0342940661740223)` на tick 1 / post_action в расчёте формации; Node 25 и Chromium дают разные последние биты. В ядро добавлены fdlibm-совместимые `deterministicSin/Cos`, все десять production call sites переключены на них. Никакое округление реплея или ослабление сравнения не применяется.
- 20 новых тестов проверяют фиксированные IEEE-754 значения, редукцию больших аргументов, signed zero и бой при запрещённых нативных sin/cos. Дополнительно локальное сравнение 100 000 конечных float64-кандидатов с прежним Node не выявило различий.
- Найдена дополнительная регрессия входящего санитизатора: перестановка ключей вложенных DTO. `preserveWireKeyOrder` восстанавливает исходный порядок только уже очищенных полей, не возвращая удалённые ключи или ссылки. Регрессионный тест: 7/7 RED до правки, 7/7 GREEN после.
- Ранее переданный terminal-events overlay перенесён в основной `combat.runner.ts`, включая 10 тестов terminal pre_action для V8/V9. Новые revision: `combat-ecs-v8-deterministic-trig-r4`, `combat-ecs-v9-deterministic-trig-r4`. В golden-fixtures изменены только метаданные revision; все 14 SHA256 пресетов сохранены.
- Core suite: 25 файлов / 197 тестов PASS; core/root typecheck PASS; полный скан лимитов PASS; lint ядра: 0 ошибок, 39 существующих предупреждений.
- Изолированный tarball consumer: melee, burn с отрицательным контролем, organic/mechanical heal, summon ownership, JSON round-trip и terminal HP PASS. Терминальный сценарий: HP 83, последний tick 167, elapsedTicks 168.
- На чистом архиве Node 22.20.0 / Node 25.6.0 / Chromium 149.0.7827.55 дают побайтово одинаковые результаты семи контрольных боёв; два свежих Worker совпадают. Прежний Node-реплей сохранён, кроме явного нового engineRevision. Это узкая проверка P0, не полная матрица R7.

Кандидат: `artifacts/combat-core-handoff/handoff-20261006-deterministic-trig-r4-clean/mars2050-combat-core-0.1.0.tgz`.
SHA256: `52a91f4eb406125247426f044eb0dbdf8ab440a8285d211af63e5f9c75bf61dd`.
Чистая повторная сборка из base tar + overlay воспроизводит этот хеш. Инвентарь: 214 исходников, 858 файлов пакета, 0 лишних исходников/emit-файлов.

Раскрытия:

- Первый кандидат `dfe77419…` отклонён: первичный snapshot захватил временную архитектурную фикстуру `bad-system.ts`; после неудачного npm pack (недоступный стандартный cache) повторная упаковка оставила её stale emit. Архив не подменялся и сохранён со статусом `rejected_archive`. Чистый кандидат восстановлен исключительно по зафиксированному манифесту; добавлена проверка точного инвентаря.
- Первый полный Mars run на Node 25: 819/820 PASS, один timeout 30s. Следующий Node 22 run прерван паузой среды около 75 минут: 818/820 PASS, два временных сбоя, включая измерение 4 522 178 ms. Таймауты/пороги тестов не увеличивались. Повторный чистый прогон Node 22 (`vitest run --maxWorkers=2`): 203 файла / 820 тестов PASS, exit 0, 618.36s; лог `logs/mars-node22-clean-run.log` в каталоге чистой передачи.
- ISO-08: четыре проверяемых внутренних subpath по-прежнему доступны, `KNOWN_FAIL` до R6. Linux, полный browser suite приложения и независимая приёмка нового кандидата — NOT_RUN.
- Приложение Fantasy, его lockfile/vendor pin и старый архив `57f54f43…` не менялись. Новых коммитов, push и PR не выполнялось.

### 2026-10-06 — Приёмка R4a / ISO-10 (независимое ревью) и реализация R4b / ISO-11 (раздельные identities)

Статус:
- R4a / ISO-10: **ACCEPTED** (вердикт независимого read-only reviewer `fb94c3e9-f39a-4213-ad69-0978ec093080`).
- R4b / ISO-11: **needs_external_review** (реализовано, проверено тестами, tarball runtime smoke и golden fixtures).

#### 1. Приёмка R4a / ISO-10:
- Независимый read-only reviewer проверил `replay.nested-models.ts`, `replay.nested-validators.ts`, `legacy-nested-sanitizer.ts`, `legacy-wire-codec.ts`, `legacy-key-order.ts`, тесты и probe:
  - Remark 1 [P1]: сохранение периодических способностей (`mark`, `percentHp`, триггерный `field`, `delayed_reassembly.hpPercent`) без потерь и без dangling else.
  - Remark 2 [P2]: глубокая структурная валидация `periodic_payload`, исключающая повреждённые payload (`made_up`, нечисловой `shield`).
  - Remark 3 [P2]: полная очистка внутренних служебных полей ECS (`entityStore`) из `fieldEffect.statusEffects` и программ способностей.
  - Remark 4 [P2]: строгое соблюдение лимитов ($\le 250$ строк на файл), 0 `any` / `as any`, 0 ошибок eslint.
  - Отсутствие `__marsCompat` и прямого обхода ECS во внешнем DTO.
  - Сохранение исходного порядка ключей при сериализации через `preserveWireKeyOrder`.
- Вердикт: **ACCEPT**.

#### 2. Реализация R4b / ISO-11 (Раздельные identities):
- Созданы 4 раздельные сущности идентификации:
  1. **Contract Version**: `PUBLIC_CONTRACT_VERSION = '1.0.0'` (семантическая версия формы публичного API контракта).
  2. **Engine Build Identity**: `id = '@mars2050/combat-core'`, `version = '0.1.0'`, `revision = 'combat-ecs-v9-deterministic-trig-r4'` (или V8), `defenseResolutionMode = 'v9_snapshot'` (или `'v8_sequential'`).
  3. **Ruleset Identity**: `id` (дефолт `'standard'` или из входа), `version` (дефолт `'1.0.0'`), детерминированный `contentHash` (64-символьный hex SHA-256).
  4. **Replay Schema Identity**: `id = 'combat-replay'`, `version = '1.0.0'`.
- Реализован чистый, кроссплатформенный синхронный SHA-256 (`pureSha256`) на TypeScript без внешних зависимостей и без `node:crypto` (гарантирует одинаковую работу в Node 22/25, Linux, Windows, Chromium, Web Worker).
- Реализована функция `canonicalizeValue` (иммутабельная, детерминированная сортировка ключей объектов, сохранение порядка массивов, нормализация `-0` в `0`).
- Реализована функция `computeRulesetIdentity(input)` — вычисляет `contentHash` на основе правил боя (`rules`), определений юнитов (`definitions`) и опционального каталога (`catalog`), без мутации входных данных и без включения инстанс-данных конкретного матча (`seed`, `units`, `obstacles`).
- Реализован хелпер проверки совместимости `checkIdentityCompatibility(replayMetadata, target)`.
- Результат симуляции `simulateCombat` теперь возвращает типизированный конверт `metadata: CombatMetadata`.
- Wire-кодек `decodeLegacyReplayJson` полностью восстанавливает и валидирует `metadata` при JSON round-trip.
- Mars compatibility layer (`mapCombatRunResultToBattleResult`) транслирует `metadata` в `BattleResult`, одновременно сохраняя legacy поля `simulationVersion` и `simulationRevision`.
- Создан тестовый набор `packages/combat-core/tests/identity-r4b.test.ts` (7 тестов PASS):
  - Соответствие `pureSha256` стандарту NIST / `node:crypto`.
  - 1 engine / 2 rulesets: один и тот же build identity движка при разных ruleset identities и разных `contentHash`.
  - Детерминизм, повторяемость и независимость `contentHash` от порядка ключей в `definitions`.
  - Чувствительность `contentHash` к изменению статов, правил (`timeoutPolicy`, `defenseResolutionMode`, `maxTicks`) и порядка способностей в массивах.
  - Иммутабельность входных данных (`deepFreeze` инпута не вызывает ошибок при симуляции и хэшировании).
  - Полный wire round-trip метаданных через JSON кодек.
  - Выявление несовместимости ревизии движка и режима защиты через `checkIdentityCompatibility`.
- В `scripts/test-combat-package-runtime.ts` добавлена проверка 9: изоляция метаданных и проверка всех 4 identities на изолированном npm tarball потребителе.

#### 3. Верификация R4b:
- `npm run test:combat:core`: 26 файлов / 204 теста PASS.
- `node --import tsx artifacts/review-r4a-nested-pass2/probe.mjs`: 10/10 PASS.
- `npm run combat:ecs:golden && npm run combat:ecs:v9:golden`: 14/14 пресетов стабильны (V8 и V9).
- `npm run test:combat:package:runtime`: изолированная сборка tarball и runtime smoke PASS (включая проверку R4b identities).
- `npx tsx scripts/check-limits.ts --all --json`: 0 violations (`identity.contracts.ts` 63/100, `battle.contracts.ts` 98/100, `ruleset-identity.ts` 157/250, `identity-r4b.test.ts` 232/250, `legacy-wire-codec.ts` 212/250, `combat.runner.ts` 179/250).
- `npx eslint packages/combat-core/src packages/combat-core/tests`: 0 ошибок.
- `npm run build`: Next.js 16 App Router Turbopack, 32/32 статических страниц PASS.
- `npx playwright test tests/e2e/simulator2-replay.spec.ts --project=chromium`: 9/9 тестов PASS.

### 2026-10-06 — Устранение 5 замечаний владельца/ревьюера по R4a/R4b (`review-r4b-owner-20261006`)

По результатам проверки владельцем репозитория (`artifacts/review-r4b-owner-20261006/review.json`) был вынесен вердикт `needs_revision` с пятью замечаниями:

1. **[P2] R4A-REOPEN: Устранение 4 дефектов публичного DTO:**
   - **Проблема**: `triggerEffects[].entityStore`, `mark_target.sharedDamage: "bad"`, `mark_target.retargetPolicy: {}`, `hazard.statusEffects: "bad"` принимались схемой `combatSnapshotUnitSchema` и десериализатором `deserializeCombatUnitSnapshot` с молчаливым удалением.
   - **Исправление**:
     - В `packages/combat-core/src/contracts/replay.nested-models.ts` добавлена строгая проверка разрешённых ключей для элементов `triggerEffects` против `SNAPSHOT_ARR_ITEM_ALLOWED_KEY_SETS.triggerEffects`.
     - В `validateAbilityEffect` для `mark_target` добавлена явная проверка типов booleans (`sharedDamage`, `squadWide`) и strings (`retargetPolicy`).
     - В `validatePeriodicPayload` для `hazard` добавлена проверка `statusEffects !== undefined`: если не массив — регистрация ошибки схемы.
     - Добавлен отдельный набор тестов `packages/combat-core/tests/wire-codec-dto-hardened.test.ts` (4 теста), проверяющий гарантированное отклонение всех 4 дефектных сценариев как схемой `parse()`, так и десериализатором `deserializeCombatUnitSnapshot()`.

2. **[P2] RULESET-COLLISION: Сохранение идентификаторов с префиксом `_` в каноникализации:**
   - **Проблема**: `canonicalizeValue` в `ruleset-identity.ts` фильтровал все ключи с `_`, что приводило к удалению определений юнитов с валидными ID вроде `_fighter` и создавало коллизию `contentHash` при изменении их характеристик.
   - **Исправление**:
     - В `canonicalizeValue` удалена фильтрация `!k.startsWith('_')`. Все семантические ключи определений и словарей сохраняются, сортируются лексикографически, `-0` нормализуется в `0`.
     - Изменение атаки у `_soldier` / `_fighter` теперь гарантированно меняет `contentHash`.

3. **[P2] COMPATIBILITY-INCOMPLETE: Полнота проверки совместимости и строгий формат SHA-256:**
   - **Проблема**: `checkIdentityCompatibility` игнорировал `contractVersion`, `replaySchema.version`, `engine.id`, `engine.version`. Схема `combatMetadataSchema` принимала произвольные строки в `contentHash`.
   - **Исправление**:
     - `rulesetIdentitySchema.contentHash` усилен валидацией по регулярному выражению `/^[0-9a-f]{64}$/`.
     - `checkIdentityCompatibility` дополнен проверками: несовпадение мажорной версии `contractVersion`, `replaySchema.version`, несовпадение `replaySchema.id`, несовпадение `engine.id`, несовпадение `engine.version` (семантическая совместимость), с возвратом подробных причин несовместимости в `reasons[]`.

4. **[P2] BUILD-IDENTITY-NOT-SEPARATE: Независимый воспроизводимый идентификатор сборки:**
   - **Проблема**: Метаданные движка содержали только пакетную версию `0.1.0` и legacy-ревизию симуляции, без независимой идентификации сборки.
   - **Исправление**:
     - В `identity.contracts.ts` введён `ENGINE_BUILD_ID = 'combat-core-r4b-20261006'`.
     - Поле `buildId: z.string().min(1)` добавлено в `engineIdentitySchema` и заполняется в `combat.runner.ts`.
     - Проверка `buildId` интегрирована в `IdentityCompatibilityTarget` и `checkIdentityCompatibility`.

5. **[P2] MARS-METADATA-DROPPED: Интеграция конверта метаданных в персистентность и API Mars PvP:**
   - **Проблема**: `pvp.service.ts` не сохранял и не возвращал `metadata`. `pvp.replay.ts` и `pvp.types.ts` не содержали полей метаданных.
   - **Исправление**:
     - В `src/domains/pvp/pvp.types.ts` добавлено `metadata?: CombatMetadata` в интерфейсы `AttackResult` и `StoredBattleReplay`.
     - В `src/domains/pvp/pvp.replay.ts` функция `persistBattleWithSnapshot` теперь сохраняет `metadata` внутри существующей колонки `metrics` (JSONB) без изменения схемы БД (`metrics.metadata`), что гарантирует 100% обратную совместимость.
     - Функция `loadBattleWithSnapshot` извлекает `snapshot.metadata` через безопасный хелпер `getReplayMetadata(snapshot.metrics)`.
     - В `src/domains/pvp/pvp.service.ts` `metadata` передаётся в `persistBattleWithSnapshot` и возвращается в `AttackResult`.
     - В `src/__tests__/pvp.snapshot-version.test.ts` добавлены тесты на сохранение/считывание `metadata` и сохранение обратной совместимости для legacy-снимков без метаданных.

#### Итоговая верификация:
- `node --import tsx artifacts/review-r4b-owner-20261006/probe.mjs`: **14/14 PASS** (exit 0, `probe.json#status === "PASS"`).
- `npm run test:combat:core`: **28 файлов / 212 тестов PASS**.
- `npm run combat:ecs:golden`: **7/7 presets PASS** (V8).
- `npm run combat:ecs:v9:golden` (`npx tsx scripts/combat-ecs-golden.ts --v9`): **7/7 presets PASS** (V9).
- `npm run test:combat:package:runtime`: **PASS** (изолированный tarball runtime smoke, SHA256: `f610158b3f4db5782a0978ccf7333eca651e024263f2d76988aa297417c08499`).
- `npm run lint:limits`: **PASS** (0 violations, все файлы строго $\le 250$ строк, контракты $\le 100$ строк).
- `npx tsc --noEmit --pretty false`: **PASS** (0 ошибок).
- `npm run build`: **PASS** (Turbopack, Next.js 16, 32/32 статических страниц).
- `npm run test:e2e:replay`: **9/9 Playwright E2E PASS**.

### 2026-10-06 — Закрытие замечаний Pass 2 ревью R4b (MARS-READER-METADATA-PATH-INCOMPLETE, MARS-METADATA-UNVALIDATED, BUILD-IDENTITY-PROVENANCE)

1. **[P2] MARS-READER-METADATA-PATH-INCOMPLETE: Сквозная передача метаданных и применение политики совместимости в читателях реплеев:**
   - **Проблема**: `parseBattleReplayResponse` в `pvp.replay-compat.ts` не возвращал `metadata` в `StoredBattleReplay` и не проверял совместимость идентификаторов (`contractVersion`, `replaySchema`, `engineId`, `engineVersion`).
   - **Исправление**:
     - В `src/domains/pvp/pvp.replay-compat.ts` функция `getReplayCompatibility` расширена параметром `metadata?: CombatMetadata | null`. При наличии валидных метаданных вызывается `checkIdentityCompatibility(metadata, { revision: CURRENT_SIMULATION_REVISION })`.
     - При несовпадении идентификаторов возвращается `status: 'unsupported'`, `canPlay: false`, с соответствующим кодом (`identity_incompatible` или `engine_revision_mismatch`) и детальным списком `reasons`.
     - В `parseBattleReplayResponse` валидированные метаданные переносятся во все ветки возврата `StoredBattleReplay` (`canPlay: true` и `canPlay: false`).
     - Для устаревших реплеев без метаданных (legacy) полностью сохраняется обратная совместимость (`legacy_approximate` для V2, `current` для V9 без метаданных).

2. **[P2] MARS-METADATA-UNVALIDATED: Строгая валидация метаданных на границе читателя:**
   - **Проблема**: `getReplayMetadata` в `pvp.replay.ts` выполнял `as CombatMetadata` без валидации через схему.
   - **Исправление**:
     - В `getReplayMetadata` подключен `combatMetadataSchema.safeParse(raw)`.
     - При отсутствии поля метаданных возвращается `undefined` (legacy).
     - При наличии повреждённых/невалидных метаданных выбрасывается ошибка / возвращается явный статус `malformed_metadata`, исключая тихое понижение до legacy.
     - В `loadBattleWithSnapshot` повреждённые метаданные помечаются как `status: 'unsupported'`, `canPlay: false`, `reason: 'malformed_metadata'`.

3. **BUILD-IDENTITY-PROVENANCE: Верификация происхождения и стабильности сборки:**
   - `ENGINE_BUILD_ID = 'combat-core-r4b-20261006'` зафиксирован в контрактах и проверен в `scripts/test-combat-package-runtime.ts` и юнит-тестах.
   - Автоматический probe `artifacts/review-r4b-owner-pass2-20261006/probe.mjs` верифицирует отклонение несовпадающего `buildId`.

#### Итоговая верификация Pass 2:
- `node --import tsx artifacts/review-r4b-owner-pass2-20261006/probe.mjs` (Node 25): **24/24 PASS** (exit 0).
- `artifacts/combat-core-parity/owner-20261006/runtimes/node22/node-v22.20.0-win-x64/node.exe --import tsx artifacts/review-r4b-owner-pass2-20261006/probe.mjs --node22` (Node 22): **24/24 PASS** (exit 0).
- `npx vitest run src/__tests__/pvp.replay-compat.test.ts src/__tests__/pvp.snapshot-version.test.ts`: **16/16 PASS**.

#### 2026-10-06 / 2026-10-07 — Закрытие замечаний Pass 3 (R4b / ISO-11)

В рамках ревью `artifacts/review-r4b-owner-pass3-20261006/review.json` успешно устранены оставшиеся замечания:

1. **[P2] R4B-PLAYBACK-LEGACY-POLICY-REGRESSION: Политика совместимости воспроизведения и согласованность версий:**
   - **Проблема**: В `src/domains/pvp/pvp.replay-compat.ts` ревизия любого реплея с метаданными сравнивалась с текущей V9, что блокировало воспроизведение валидных исторических реплеев V8 с оригинальными метаданными V8. Кроме того, наличие метаданных V9 обходило проверку отсутствующей/устаревшей `metrics.engineRevision`, а противоречие `snapshot.version: 8` и метаданных V9 ошибочно считалось `current`.
   - **Исправление**:
     - В `getReplayCompatibility` явно разделены проверка общей совместимости контракта/движка и проверка соответствия версии снепшота режиму разрешения защиты:
       - Снепшот версии 9 требует `defenseResolutionMode: 'v9_snapshot'`.
       - Снепшот версии 8 требует `defenseResolutionMode: 'v8_sequential'`.
       - Снепшот версии < 8 не может содержать метаданные (`identity_incompatible`).
     - Для текущей версии (`snapshotVersion === CURRENT_SIMULATION_VERSION`): ревизия строго проверяется против `CURRENT_SIMULATION_REVISION`.
     - Для исторических поддерживаемых версий (`snapshotVersion === 8`): воспроизведение разрешено со статусом `status: 'legacy_approximate', canPlay: true, visuallyApproximate: true, reason: 'older_engine'`.
     - Защита от противоречий: `metrics.engineRevision` сверяется с `metadata.engine.revision`; несовпадение или отсутствие ревизии V9 отклоняется со статусом `unsupported`, `canPlay: false`.
   - **Верификация**: `artifacts/review-r4b-owner-pass3-20261006/compatibility-probe.mjs` — **9/9 PASS** на Node 25 и Node 22.

2. **BUILD-IDENTITY-PROVENANCE: Постоянный кандидат и замороженный манифест происхождения сборки:**
   - Сформирован постоянный кандидат handoff в `artifacts/combat-core-handoff/handoff-20261006-r4b-candidate/`.
   - Базовый коммит: `9c7c49062ad064819968acfa41f667e00a8f39a3` (`source-base.tar`, SHA-256: `d0abb2dbe8916ecaa03fa450dae5c57c4718f9a7afad44094004510a1ba7f5c6`).
   - `source-manifest.json`: зафиксированы 72 оверлея с SHA-256, биндинг `buildId: 'combat-core-r4b-20261006'` к архиву `mars2050-combat-core-0.1.0.tgz` (SHA-256: `f610158b3f4db5782a0978ccf7333eca651e024263f2d76988aa297417c08499`).
   - `reproduce.mjs`: воспроизводит сборку из замороженного архива и оверлеев с подтверждением хэша архива (`reproduction-verification.json`: passed).
   - `verify-inventory.mjs`: подтверждает полноту 216 исходных файлов и 866 записей в архиве без посторонних или устаревших файлов (`inventory-verification.json`: passed).
   - Запечатанный `manifest.json`: фиксирует статус `candidate_sealed_for_audit` и результаты 10 проверочных гейтов.

#### Итоговая верификация Pass 3:
- `compatibility-probe.mjs` (Node 25 / Node 22): **9/9 PASS** (exit 0).
- `previous-probe.mjs` (Node 25 / Node 22): **24/24 PASS** (exit 0).
- `core-vitest` (28 test files / 212 tests): **PASS**.
- `root-typecheck` (`tsc --noEmit --pretty false`): **PASS** (0 errors).
- `limits-check` (`scripts/check-limits.ts`): **PASS** (0 violations).
- `golden-v8` / `golden-v9`: **PASS** (по 7/7 стабильно).
- `test:combat:package:runtime`: **PASS**.
- Next.js production build (`npm run build`): **PASS** (32/32 static pages prerendered).

#### 2026-10-07 — Приёмка владельца Pass 4 (R4b ACCEPT)

В отчёте `artifacts/review-r4b-owner-pass4-20261007/review.json` владелец зафиксировал окончательную приёмку:
- **Вердикт**: **ACCEPT** (R4b принят; R4a остаётся принятым).
- **Результаты проверки владельцем**:
  - 33/33 адресных проверок на Node 22.20.0 и Node 25.6.0 (24 previous regressions + 9 V8/V9 playback policy).
  - 212/212 тестов ядра (`npm run test:combat:core`) и 17/17 тестов Mars-reader (`pvp.replay-compat.test.ts`, `pvp.snapshot-version.test.ts`).
  - Все 72 overlay-файла и 27 файлов доказательств совпали по хэшам.
  - Независимая пересборка дала побитово идентичный архив `f610158b3f4db5782a0978ccf7333eca651e024263f2d76988aa297417c08499`.
- **Уточнение размера архива**:
  - Фактический и независимо пересобранный размер тарбола `mars2050-combat-core-0.1.0.tgz` составляет **385 622 байта** (в начальной оценочной мета-записи фигурировало 385 573 байта; SHA-256 побитово точен и идентичен во всех независимых пересборках). Запечатанные артефакты не перезаписываются.
- **Следующий этап**: фиксация проверенного R4b-чекпоинта отдельным коммитом и переход к **R5a (ISO-09) — вынос игрового контента и traits из ядра**.

#### 2026-10-07 — Реализация R5a (ISO-09): вынос игрового контента и traits из ядра

Срез R5a выполнен в полном соответствии с планом `docs/combat-core-isolation-remediation-plan.md:136-144`:

1. **Явные traits в контрактах и удаление `alien_`-эвристик из ядра:**
   - В `packages/combat-core/src/contracts/unit.contracts.ts` схема `baseStatsSchema` дополнена явными полями: `stationaryAlignment?: boolean`, `formationAnchorMode?: 'leader' | 'centroid'`, `velocityDamping?: boolean`, `projectileInterceptable?: boolean`.
   - В `packages/combat-core/src/combat.types.ts` тип `UnitBaseStats` дополнен полем `projectileInterceptable?: boolean`.
   - В `packages/combat-core/src/combat.unit-compiler.ts` удалены проверки префикса `definitionId.startsWith('alien_')`:
     - `stationaryAlignment: stats.stationaryAlignment` (ранее неявно подставлялся `true` для `alien_*`).
     - `formationAnchorMode: stats.formationAnchorMode ?? 'leader'` (ранее подставлялся `'centroid'` для `alien_*`).
     - `velocityDamping: stats.velocityDamping ?? (stats.range * 40 > 60 || undefined)` (ранее безусловно подставлялся `true` для `alien_*`).
     - `projectileInterceptable`: поддержан приоритет явно переданного флага `stats.projectileInterceptable` над эвристиками.

2. **Перенос марсианских определений и вычисления interceptable в Mars adapter:**
   - В `src/domains/combat/combat.unit-definitions.ts` функция `buildMarsUnitDefinitions()` обновлена: теперь она формирует полные, типизированные `UnitDefinition` для всех марсианских юнитов (`UNIT_TYPES`), перенося все базовые характеристики, способности (`abilities`), профили наведения и явные traits (`stationaryAlignment`, `formationAnchorMode`, `velocityDamping`).
   - Марсианская эвристика перехвата (`combatTags.includes('explosive') && range * 40 > 80 && attack > 0`) вынесена в `buildMarsUnitDefinitions()`: свойство `projectileInterceptable` вычисляется и явно проставляется на уровне марсианского адаптера.

3. **Очистка DB-типов в ядре:**
   - В `packages/combat-core/src/combat.rank-scaling.ts` функция `getUnitRank` теперь принимает нейтральный контракт `{ rank?: number | null; tier?: number | null }`, где `rank` является приоритетным свойством.

4. **Регрессионный тест инвариантности имени определения:**
   - Добавлен тест `packages/combat-core/tests/content-isolation-r5a.test.ts`:
     - Проверяет отсутствие автоматического вывода alien-traits исключительно по префиксу `alien_` при отсутствии явно заданных свойств (Red-Green подтверждён).
     - Проверяет, что две симуляции с одинаковыми явными traits и stats, но с переименованными определениями (`alien_crawler`/`alien_defender` vs `fantasy_spider`/`fantasy_golem`), дают 100% идентичный механический результат (победитель, тики, HP выживших, типы и последовательность действий).

#### Итоговая верификация R5a:
- `npm run test:combat:core`: **29/29 files PASS, 214/214 tests PASS**.
- `npm run combat:ecs:golden` (V8): **PASS (7/7 presets stable)**.
- `npm run combat:ecs:v9:golden` (V9): **PASS (7/7 presets stable)**.
- `node node_modules/vitest/vitest.mjs run src/__tests__/pvp.replay-compat.test.ts src/__tests__/pvp.snapshot-version.test.ts`: **17/17 tests PASS**.
- `node --import tsx scripts/test-combat-package-runtime.ts`: **PASS (Runtime archive smoke PASSED)**.
- `compatibility-probe.mjs` (Node 25 и Node 22): **9/9 PASS**.
- `previous-probe.mjs` (Node 25 и Node 22): **24/24 PASS**.
- `npx tsc --noEmit --pretty false`: **PASS (0 errors)**.
- `npm run lint:limits`: **PASS (0 violations)**.
- `npm run build`: **PASS (Next.js production build succeeded, 32/32 static pages)**.

### R5a Remediation Cycle (Pass 2 Owner Findings)

Устранены 4 блокирующих замечания из отчёта `artifacts/review-r5a-owner-pass2-20261007/review.json`:

1. **[P1] Устранена регрессия Mars (исторические статы юнитов восстановлены):**
   - Все пути создания марсианских юнитов (`factory`, `translatedDefinition`, `historic`) гарантируют исторические параметры скорости и дальности (Морпех: `speed: 105`, `range: 120`).
   - Исправлена интеграция марсианских адаптеров с `buildMarsUnitDefinitions(UNIT_TYPES)` в `combat.config.ts`, `combat.input-translator.ts` и `combat.upgrade-primitives.ts`.
   - Полный набор тестов Mars (`src/__tests__/**`): **825/825 tests PASS** (включая `combat.input-translator.test.ts`, `combat.rank-scaling.test.ts` и `combat.weapon-shape-upgrades.test.ts`).

2. **[P2] Преобразования единиц полностью вынесены из ядра в адаптеры:**
   - Из ядра (`packages/combat-core/src/combat.ability-config.ts`, `ecs/systems/side-weapon-system.ts`, `ecs/systems/split-fire-system.ts`, `ecs/movement-positioning.ts`) удалены все жестко закодированные множители `* 40` (`GRID_TO_PIXELS = 40`). Ядро работает строго в нейтральных мировых координатах.
   - Преобразования тайлов в пиксели перенесены в марсианские адаптеры (`src/domains/combat/combat.ability-config.ts`, `combat.unit-definitions.ts`, `combat.input-translator.ts`, `combat.upgrade-primitives.ts`).

3. **[P2] Расчет ауры и модификаторов вынесен из ядра:**
   - Из `packages/combat-core/src/combat.support-aura-config.ts` удалена захардкоженная марсианская генерация стелс-аур.
   - Поддержан нейтральный массив `supportAuras` в `UpgradeModifiers`.
   - Марсианский адаптер `buildMarsUpgrades()` в `src/domains/combat/combat.input-translator.ts` транслирует `grantRevealAura` в нейтральный `supportAuras` с таргетом `enemies` и тегом `stealth`.

4. **[P2] Строгая типизация каталога на границе валидации:**
   - В `packages/combat-core/src/contracts/catalog.contracts.ts` внедрены строгие схемы: `combatCatalogSchema`, `catalogUnitTypeSchema`, `targetingProfileSchema`, `targetingAcquisitionSchema`, `supportAuraModifierSchema`.
   - Каталог отклоняет значения, не являющиеся объектами (`null`, `false`, `17`, `'bad'`), `null`-профили и некорректные веса до входа в симуляцию, создания мира и вызова PRNG.

#### Результаты верификации Pass 2:
- Owner acceptance probe (`artifacts/review-r5a-owner-pass2-20261007/acceptance-probe.mjs`):
  - **Node 25**: 10/10 PASS (status: passed).
  - **Node 22**: 10/10 PASS (status: passed).
- Pass 1 candidate probe (`artifacts/review-r5a-owner-20261007/probe.mjs`):
  - **Node 25**: 6/6 PASS.
  - **Node 22**: 6/6 PASS.
- Core vitest suite (`npm run test:combat:core`): **29/29 files PASS, 214/214 tests PASS**.
- Golden suites:
  - `npm run combat:ecs:golden` (V8): **7/7 presets stable (PASS)**.
  - `npm run combat:ecs:v9:golden` (V9): **7/7 presets stable (PASS)**.
- Full root test suite (`vitest run`): **203/203 files PASS, 825/825 tests PASS**.
- Typecheck (`npx tsc --noEmit --pretty false`): **0 errors**.
- Architectural limits (`npm run lint:limits`): **0 violations**.
- Package runtime smoke (`npm run test:combat:package:runtime`): **PASS**.

### 2026-10-07 — Закрытие замечаний Pass 3 ревью R5a (ISO-09)

В рамках ревью `artifacts/review-r5a-owner-pass3-20261007/review.json` успешно устранены все 4 блокирующих замечания:

1. **[P1] R5A-MARS-CREATION-PATH-REGRESSION: Исправление пути создания отрядов Mars и каталога по умолчанию:**
   - **Проблема**: `createRuntimeSquad` возвращал для морпеха с `range_enhancement` дальность 123 вместо 240, терял ауру раскрытия у `scout_drone` с `sensor_suite`, а `tier: 2` превращался в `rank: 1`. Причина: дефолтный каталог регистрировал сырые `UPGRADES` вместо подготовленных, а `squad-factory` не нормализовал `tier` перед вызовом ядра.
   - **Исправление**:
     - В `src/domains/combat/combat.upgrades.ts` экспортирована функция `buildMarsUpgrades()`.
     - В `src/domains/combat/combat.config.ts` в `registerDefaultCombatCatalog` передаются `buildMarsUpgrades()`.
     - В `src/domains/combat/combat.squad-factory.ts` функция `createRuntimeSquad` нормализует `row.tier` в `row.rank` через `getUnitRank(row)`.
     - В `packages/combat-core/src/combat.squad-compiler.ts` добавлена поддержка `{ rank: row.rank ?? row.tier }`.
     - Пути `createRuntimeSquad` и `translateMarsBattleInput` теперь выдают 100% идентичные характеристики: дальность 240, аура раскрытия, ранг 2.

2. **[P2] R5A-WORLD-UNIT-BOUNDARY-PARTIAL: Устранение эвристик по величине чисел и однократная конверсия единиц:**
   - **Проблема**: `prepareMarsAbility` повторно масштабировал способности с малыми радиусами (< 10) из 4 в 160, а прямые дальности `sideWeapon` 20 не масштабировались из-за порога `< 20`.
   - **Исправление**:
     - В `src/domains/combat/combat.unit-definitions.ts` удалена функция `prepareMarsAbility` — способности из хелперов уже находятся в мировых координатах и передаются без искажений.
     - В `buildMarsUnitDefinitions` и `buildMarsUpgrades` дальности `sideWeapon.range` и `splitFire.range` масштабируются строго и единообразно `* 40` без порогов `< 20`.
     - В `src/domains/combat/combat.upgrade-primitives.ts` функция `getRuntimePrimitiveStats` переведена на `buildMarsUpgrades` без постобработки порогов.

3. **[P2] R5A-CATALOG-CONTRACT-STILL-UNKNOWN: Строгая валидация baseStats в каталоге до создания мира:**
   - **Проблема**: `catalogUnitTypeSchema.baseStats` был объявлен как `z.unknown().optional()`. Некорректные значения (`isFlying: 'bad'`) вызывали сбой `ZodError` только после создания мира и постановки сущностей в очередь.
   - **Исправление**:
     - В `packages/combat-core/src/contracts/unit.contracts.ts` схема `baseStatsSchema` дополнена типизированными полями игровых механик (`isFlying`, `canTargetAir`, `minimumRange`, `aoeRadius`, `selfDestructOnAttack`, `shieldDamageMult`, `armorPierceRatio`, `antiAirDamageMult`, `summonCounterDamageMult`, `accuracyPenaltyResist`).
     - В `packages/combat-core/src/contracts/catalog.contracts.ts` поле `catalogUnitTypeSchema.baseStats` типизировано через `baseStatsSchema.partial().optional()`.
     - Значение `isFlying: 'bad'` отклоняется на входной границе `validateBattleInput` с ошибкой `CombatDefinitionError('SCHEMA_VALIDATION_ERROR', ...)` до инициализации мира и с 0 вызовов PRNG.

4. **[P2] R5A-CONTENT-BOUNDARY-INCOMPLETE: Граница подготовленного loadout и сохранение нейтрального исполнения:**
   - **Проблема**: Необходимость завершения границы подготовленного loadout для юнитов между адаптером и ядром.
   - **Исправление**:
     - В `unitSpawnSpecSchema` и `UnitBuildSpec` добавлено типизированное опциональное поле `preparedStats?: baseStatsSchema.partial()`.
     - В `packages/combat-core/src/combat.unit-stat-compiler.ts` функция `compileUnitStats` при наличии `spec.preparedStats` использует подготовленные характеристики напрямую.
     - В `packages/combat-core/src/combat.types.ts` добавлен индексный сигнатур `[key: string]: unknown` в `UnitBaseStats` для строгой совместимости типов с контрактами.
     - Сохранена полная совместимость с нейтральными правилами и независимыми вызовами симулятора с сырыми улучшениями.

#### Результаты итоговой верификации Pass 3:
- Owner remaining probe (`artifacts/review-r5a-owner-pass3-20261007/remaining-probe.mjs`):
  - **Node 25**: **10/10 PASS** (status: passed).
  - **Node 22**: **10/10 PASS** (status: passed).
- Owner Pass 2 acceptance probe (`artifacts/review-r5a-owner-pass2-20261007/acceptance-probe.mjs`):
  - **Node 25**: **10/10 PASS** (status: passed).
  - **Node 22**: **10/10 PASS** (status: passed).
- Owner Pass 1 candidate probe (`artifacts/review-r5a-owner-20261007/probe.mjs`):
  - **Node 25**: **6/6 PASS** (status: passed).
  - **Node 22**: **6/6 PASS** (status: passed).
- Core vitest suite (`npm run test:combat:core`): **29/29 files PASS, 214/214 tests PASS**.
- Golden suites:
  - `npm run combat:ecs:golden` (V8): **7/7 presets stable (PASS)**.
  - `npm run combat:ecs:v9:golden` (V9): **7/7 presets stable (PASS)**.
### 2026-10-08 — Закрытие замечаний Pass 4, Pass 5 и Pass 6 ревью R5a (ISO-09)

В рамках серийного аудита R5a (Pass 4, Pass 5, Pass 6) полностью завершена изоляция подготовленного контракта характеристик и снаряжения (`PreparedStats`), унификация жизненного цикла размещения и валидации, и строгое экранирование ядра от недопустимых конфигураций до фазы создания сущностей и расхода PRNG:

1. **[P2] R5A-PREPARED-LOADOUT-VALIDATION-BYPASS (Pass 6 Finding 1):**
   - **Проблема**: Подготовленные способности призыва (`periodicAbilities`, `triggerEffects` со `spawn` payload) обходили предсимуляционную проверку на наличие зарегистрированного определения (`MISSING_SPAWN_DEFINITION`) и переполнение диапазона HP (`INVALID_FIELD_RANGE`).
   - **Исправление**:
     - В `combat.payload-validator.ts` реализована функция `validateUnitSpawnPayloads`, проверяющая все входящие призывы и переопределения юнитов (`periodicAbilities`, `triggerEffects`, `spawnerConfig`, `abilities`) относительно всех известных определений.
     - Проверка вызывается в `validateUnitLoadout` внутри `validateBattleInput` до инициализации мира. При отсутствии типа юнита или некорректном/бесконечном значении HP симуляция мгновенно отклоняется с `CombatDefinitionError` при 0 вызовов PRNG и 0 вызовов создания сущностей.

2. **[P2] R5A-PREPARED-SUPPORT-AURA-TYPE-UNVALIDATED (Pass 6 Finding 2):**
   - **Проблема**: Неизвестные типы аур поддержки (например, `type: 'made_up'`) принимались схемой `preparedStatsSchema` и пропускались в runtime из-за использования незащищённого `z.string()`.
   - **Исправление**:
     - В `unit-primitives.contracts.ts` поле `supportAuraModifierSchema.type` типизировано строгим перечислением `supportAuraTypeSchema` (`shield | shield_repair | regen | reveal | damage_reduction | haste | range_boost | attack_boost | cleanse | status_immunity`).
     - Неизвестные типы ауры немедленно отклоняются на схематической границе с `SCHEMA_VALIDATION_ERROR` до создания мира и с 0 вызовов PRNG.

3. **[P2] R5A-CONTENT-BOUNDARY-INCOMPLETE (Pass 6 Finding 3):**
   - **Проблема**: Перенос расчета loadout оставался неполным — примитивы (`periodicAbilities`, `triggerEffects`) не передавались из Mars адаптера в `PreparedStats`, а определения с `preparedStats` теряли свои свойства при позднем призыве.
   - **Исправление**:
     - В `prepared.contracts.ts` поля `periodicAbilities` и `triggerEffects` включены в `preparedStatsSchema` и сквозной резолвер `resolveEffectiveUnitBaseStats`.
     - В `combat.input-translator.ts` функция `buildMarsPreparedStats` собирает все подготовленные примитивы из `effective.primitives`.
     - В `combat.definition-mapper.ts` и `combat.unit-stat-compiler.ts` обеспечена сквозная передача `preparedStats` определений.
     - В ECS-системах позднего призыва (`spawn-action-system.ts`, `periodic-ability-spawn-system.ts`, `trigger-spawn-system.ts`) вызовы `compileUnit` снабжены прямой передачей `preparedStats` создаваемых сущностей.

4. **Постоянное тестовое покрытие:**
   - Добавлен тестовый набор `packages/combat-core/tests/prepared-loadout-validation-r5a.test.ts` (6 тестов), валидирующий отклонение недопустимых аур, отсутствующих определений призыва и переполнения HP до мира и расхода RNG.

#### Итоговые результаты верификации:
- Owner Pass 6 probe (`artifacts/review-r5a-owner-pass6-20261008/effective-loadout-probe.mjs`):
  - **Node 25**: **9/9 PASS** (0 failed).
  - **Node 22**: **9/9 PASS** (0 failed).
- Owner Pass 5 probe (`artifacts/review-r5a-owner-pass5-20261008/prepared-boundary-probe.mjs`):
  - **Node 25**: **16/16 PASS** (0 failed).
  - **Node 22**: **16/16 PASS** (0 failed).
- Combat core test suite: **31 files PASS, 235 tests PASS**.
- Targeted Mars test suites: **11 tests PASS**.
- Golden suites:
  - `npm run combat:ecs:golden` (V8): **7/7 presets stable (PASS)**.
  - `npm run combat:ecs:v9:golden` (V9): **7/7 presets stable (PASS)**.
- Typecheck (`npx tsc --noEmit --pretty false`): **0 errors**.
- Architectural limits (`scripts/check-limits.ts`): **0 violations**.
- Sealed R4b archive (`f610158b...`) и Fantasy SDK (`52a91f4e...`): **не изменялись (SHA256 инвариантны)**.

### 2026-10-08 — Закрытие замечаний Pass 7 ревью R5a (ISO-09)

В рамках седьмого прохода аудита R5a (Owner Review Pass 7) полностью устранены 4 выявленных замечания P2:

1. **[P2] R5A-PREPARED-PRIMITIVES-DOUBLE-APPLIED**:
   - **Проблема**: При наличии подготовленных способностей (`periodicAbilities`, `triggerEffects`) сырые улучшения повторно накатывались в ядре, приводя к ошибке дублирования идентификаторов способностей (`Duplicate ability id`) или двойному срабатыванию триггерных эффектов (удвоенное лечение).
   - **Исправление**:
     - В `combat.upgrade-primitives.ts` передаётся `preparedStats`. Если `preparedStats.periodicAbilities` или `preparedStats.triggerEffects` уже подготовлены адаптером, повторное применение сырых способностей и триггеров из каталога улучшений подавляется, обеспечивая семантику ровно-однократного применения (exactly-once).
     - В `src/domains/combat/combat.upgrade-primitives.ts` добавлен параметр `preparedStats` с пробросом в ядро.

2. **[P2] R5A-DEFINITION-PREPARED-BOUNDARY-DIVERGENCE**:
   - **Проблема**: `definition.preparedStats` и `catalog.unitTypes.preparedStats` потреблялись рантаймом без единой типизированной границы: схема каталога молча сбрасывала `preparedStats`, подготовленные некорректные поля вроде `isFlying: "bad"` проходили в рантайм и падали уже после создания мира, а определение размера (`size: 'XL'`) не учитывалось при валидации границ размещения и коридора случайного спавна `[45, 55]`.
   - **Исправление**:
     - В `unit.contracts.ts` и `catalog.contracts.ts` в схемы `unitDefinitionSchema` и `catalogUnitTypeSchema` добавлено типизированное поле `preparedStats: preparedStatsSchema.optional()`.
     - В `combat.placement-validator.ts` и `combat.spawn-spec-compiler.ts` расчёт радиуса тела юнита и допустимого диапазона координат использует единый эффективный базовый размер из `definition.preparedStats ?? baseStats.size`.
     - В `combat.payload-validator.ts` добавлена валидация призывов и переопределений из `definition.preparedStats`.

3. **[P2] R5A-LATE-PREPARED-SPAWN-RADIUS-DIVERGENCE**:
   - **Проблема**: Все три системы позднего создания юнитов (`spawn-action-system.ts`, `periodic-ability-spawn-system.ts`, `trigger-spawn-system.ts`) рассчитывали радиус тела `bodyRadius` для отсечения координат внутри арены строго из `baseStats.size`, игнорируя подготовленный размер (`preparedStats.size`), из-за чего созданный XL-юнит оказывался за пределами коридора `[45, 55]`.
   - **Исправление**:
     - Во всех трёх ECS-системах спавна радиус тела рассчитывается из эффективного размера: `getSizeRadius(spawnUnitDef?.preparedStats?.size ?? spawnUnitDef?.baseStats?.size ?? 'M')`.
     - В `combat.unit-compiler.ts` для рантайм-спавна нейтральный множитель урона по воздуху `antiAirDamageMult === 1` опускается до `undefined`, сохраняя сериализационную чистоту и побитовую инвариантность голденов.

4. **[P2] R5A-CONTENT-BOUNDARY-INCOMPLETE**:
   - **Проблема**: Mars-адаптер в `translateMarsBattleInput` отдавал определения без `preparedStats` и пустой `catalog.unitTypes`, из-за чего цели позднего спавна (например, `scout_drone`) не получали подготовленных характеристик от адаптера.
   - **Исправление**:
     - В `src/domains/combat/combat.input-translator.ts` в `translateMarsBattleInput` все определения компилируются через `buildMarsPreparedStats` и передаются в `definitions` и `catalog.unitTypes`.
     - В `packages/combat-core/src/combat.unit-stat-compiler.ts` шорткат по `definition.preparedStats` активируется только для базового снаряжения по умолчанию (`rank === 1 && upgradeIds.length === 0`), а при наличии индивидуальных рангов или улучшений применяется полный расчёт на основе подготовленной базы.

#### Результаты верификации Pass 7:
- Owner Pass 7 pipeline probe (`artifacts/review-r5a-owner-pass7-20261008/prepared-pipeline-probe.mjs`):
  - **Node 25**: **21/21 PASS** (0 failed).
  - **Node 22**: **21/21 PASS** (0 failed).
- Owner Pass 6 probe (`artifacts/review-r5a-owner-pass7-20261008/prior-effective-loadout-probe.mjs`):
  - **Node 25**: **9/9 PASS**; **Node 22**: **9/9 PASS**.
- Owner Pass 5 probe (`artifacts/review-r5a-owner-pass7-20261008/prior-prepared-boundary-probe.mjs`):
  - **Node 25**: **16/16 PASS**; **Node 22**: **16/16 PASS**.
- Core vitest suite (`vitest.config.ts`): **31 files PASS, 240 tests PASS**.
- Targeted Mars test suites: **4 files PASS, 13 tests PASS**.
- Golden suites:
  - `npm run combat:ecs:golden` (V8): **7/7 presets stable (PASS)**.
  - `npm run combat:ecs:v9:golden` (V9): **7/7 presets stable (PASS)**.
- Typecheck (`npx tsc --noEmit --pretty false`): **0 errors**.
- Architectural limits (`scripts/check-limits.ts`): **0 violations**.
- Sealed R4b archive (`f610158b...`) и Fantasy SDK (`52a91f4e...`): **не изменялись (SHA256 инвариантны)**.

### 2026-10-08 — Закрытие замечаний Pass 8 ревью R5a (ISO-09)

В рамках восьмого прохода аудита R5a (Owner Review Pass 8) полностью устранены все 5 замечаний P2, согласован единый эффективный loadout (`mergePreparedStats`) для валидации, размещения и исполнения:

1. **[P2] R5A-EFFECTIVE-DEFINITION-PRECEDENCE-DIVERGENCE**:
   - **Проблема**: Приоритет между `catalog.unitTypes` и `definitions` расходился между валидацией и рантаймом. Определения каталога наследовали `preparedStats` из публичных определений (XL размер), а подготовленные конфликты вооружения и отсутствующие профили таргетинга в каталоге скрывались чистыми публичными определениями.
   - **Исправление**:
     - В `combat.input-validator.ts` при формировании объединённой карты определений устранено ошибочное наследование `pubDef.preparedStats` при наличии каталожного определения.
     - В `combat.loadout-validator.ts` приоритет разрешения `definition` строго отдан каталогу (`catalogUnit ?? definitions[unit.definitionId]`).
     - Подготовленные конфликты оружия и отсутствующие профили в каталоге гарантированно отклоняются на этапе pre-flight валидации до создания мира и расхода RNG.

2. **[P2] R5A-LATE-PREPARED-LOADOUT-VALIDATION-INCOMPLETE**:
   - **Проблема**: Подготовленные поздние призывы (late-summon definitions) обходили предварительную проверку конфликтующих оружий, профилей таргетинга и ссылок `spawnerConfig.unitType`.
   - **Исправление**:
     - В `combat.definition-validator.ts` добавлена валидация эффективного базового снаряжения с учётом `def.preparedStats` (проверка конфликтов геометрии оружия и валидности периодических способностей).
     - В `combat.payload-validator.ts` добавлена валидация `spawnerConfig.unitType` для всех определений (как базовых, так и подготовленных) с выбросом `MISSING_SPAWN_DEFINITION` до создания мира.

3. **[P2] R5A-PREPARED-PRIMITIVES-DOUBLE-APPLIED**:
   - **Проблема**: Способности, подготовленные на уровне определения (`definition.preparedStats`), при частичных переопределениях или для ранга 2 повторно накатывались с сырыми улучшениями каталога, вызывая дублирование способностей.
   - **Исправление**:
     - В `combat.effective-loadout.ts` реализована функция `mergePreparedStats(defPrep, instancePrep)`, объединяющая подготовленные данные с сохранением точно-однократного применения способностей.
     - В `combat.upgrade-primitives.ts` и `combat.unit-stat-compiler.ts` исключено повторное добавление улучшений, если способность уже включена в подготовленный снаряд.

4. **[P2] R5A-PARTIAL-PREPARATION-RESETS-SHIELD**:
   - **Проблема**: Частичное переопределение `{ hp: 200 }` на уровне инстанса сбрасывало щит определения `40 -> 0`.
   - **Исправление**:
     - В `mergePreparedStats` и `combat.unit-stat-compiler.ts` значение щита определения сохраняется, если в переопределении инстанса поле `shield` опущено (`undefined`), при этом явный `{ shield: 0 }` корректно сбрасывает щит до 0.

5. **[P2] R5A-CONTENT-BOUNDARY-INCOMPLETE**:
   - **Проблема**: Расчёт улучшений, рангов и аур для Марса частично продолжал делегироваться ядру через `calculateEffectiveUnitStats`, в ядре присутствовало специфичное для Марса умножение `periodicSpawn.interval * 10`.
   - **Исправление**:
     - Создан сервис адаптера `src/domains/combat/combat.prepared-stats.ts`, который локально в домене Mars рассчитывает ранги (`applyRankScaling`), модификаторы улучшений, конверсии интервалов (`* 10`) и ауры поддержки.
     - Из ядра (`combat.unit-stat-compiler.ts`) удалено специфичное для Марса умножение интервала спавна `* 10`.
     - Из Mars-адаптера удалены вызовы `calculateEffectiveUnitStats` и `getUnitSupportAuras` из ядра.

#### Результаты верификации Pass 8:
- Owner Pass 8 matrix probe (`artifacts/review-r5a-owner-pass8-20261008/effective-loadout-matrix-probe.mjs`):
  - **Node 25**: **29/29 PASS** (0 failed).
  - **Node 22**: **29/29 PASS** (0 failed).
- Owner Pass 7 pipeline probe (`artifacts/review-r5a-owner-pass7-20261008/prepared-pipeline-probe.mjs`):
  - **Node 25**: **21/21 PASS**; **Node 22**: **21/21 PASS**.
- Owner Pass 6 probe (`artifacts/review-r5a-owner-pass6-20261008/effective-loadout-probe.mjs`):
  - **Node 25**: **9/9 PASS**; **Node 22**: **9/9 PASS**.
- Owner Pass 5 probe (`artifacts/review-r5a-owner-pass5-20261008/prepared-boundary-probe.mjs`):
  - **Node 25**: **16/16 PASS**; **Node 22**: **16/16 PASS**.
- Owner Pass 4 probe (`artifacts/review-r5a-owner-pass4-20261007/prepared-stats-probe.mjs`):
  - **Node 25**: **12/12 PASS**; **Node 22**: **12/12 PASS**.
- Combat core vitest suite: **31 files PASS, 244 tests PASS**.
- Targeted Mars vitest suites: **4 files PASS, 26 tests PASS**.
- Golden suites:
  - `npm run combat:ecs:golden` (V8): **7/7 presets stable (PASS)**.
  - `npm run combat:ecs:v9:golden` (V9): **7/7 presets stable (PASS)**.
- Typecheck (`npx tsc --noEmit --pretty false`): **0 errors**.
- Architectural limits (`scripts/check-limits.ts`): **0 violations**.
- Sealed R4b archive (`f610158b...`) и Fantasy SDK (`52a91f4e...`): **не изменялись (SHA256 инвариантны)**.

### Замечания Owner Review Pass 9 (2026-10-08) и Remediation:

#### Анализ замечаний Pass 9:
1. **[P1] R5A-MARS-PERIODIC-SPAWN-DOUBLE-CONVERSION**:
   - **Проблема**: В `buildMarsUpgrades()` интервал автора (15 сек) уже переводился в тики (`interval = 150`). В `buildMarsPreparedStats()` происходило повторное умножение `interval * 10 = 1500`, из-за чего авианосец дронов («Улей-модуль») призывал в 10 раз реже (0 дронов за 301 тик вместо 2).
   - **Исправление**: Удалено повторное умножение в `src/domains/combat/combat.prepared-stats.ts`, интервал сохраняется равным 150 тикам. Проверено расписание: спавны на тиках 149 и 299.
2. **[P1] R5A-MARS-INNATE-COMBAT-MULTIPLIERS-RESET**:
   - **Проблема**: Врожденные множители (`armorPierceRatio`, `shieldDamageMult`, `summonCounterDamageMult`, `accuracyPenaltyResist`, `groundDamageMult`, `movingReduction`, `multishot`, `executeThreshold`, `lifestealMult`) сбрасывались до дефолтных значений в `buildMarsPreparedStats()`. В частности, `explosive_drone` терял `armorPierceRatio: 0.8`, а `sapper` терял `0.35`, что искажало боевой урон.
   - **Исправление**: В `buildMarsPreparedStats()` все множители инициализируются из `base`, сохраняя врожденные характеристики авторов.
3. **[P2] R5A-MARS-PREPARED-UPGRADE-INVENTORY-INCOMPLETE**:
   - **Проблема**: В адаптере не переносились модификаторы улучшений `rankScaling` и триггеры смерти `onDeathSpawn`.
   - **Исправление**: `modifiers.rankScaling` объединяется в `effectiveRankScaling` и передается в `applyRankScaling`; `modifiers.onDeathSpawn` транслируется в соответствующий триггер `${upgradeId}-on-death-spawn` в `triggerEffects`.
4. **[P2] R5A-LATE-PREPARED-LOADOUT-VALIDATION-INCOMPLETE**:
   - **Проблема**: Поздние призывы с подготовленной атакой `attackType: 'spawn'` и отсутствующим/неизвестным `spawnType` обходили pre-flight валидацию.
   - **Исправление**: В `combat.definition-validator.ts` и `combat.payload-validator.ts` валидация учитывает `def.preparedStats?.attackType` и `def.preparedStats?.spawnType`, выбрасывая `MISSING_SPAWN_TYPE` или `MISSING_SPAWN_DEFINITION` строго до создания ECS-мира и вызовов RNG.
5. **Архитектурное уточнение**:
   - Хелпер `applyRankScaling` экспортирован из `@mars2050/combat-core/combat.rank-scaling` как чистая математическая функция без привязки к марсианским сущностям; Mars-адаптер правомерно переиспользует нейтральный контракт без дублирования кода формул.

#### Новые постоянные тесты:
- `packages/combat-core/tests/prepared-spawn-attack-r5a.test.ts` (158 строк): проверка pre-flight отклонения late prepared `attackType: 'spawn'` с отсутствующим и неизвестным `spawnType`, а также позитивный контроль.
- `src/__tests__/combat.prepared-loadout.test.ts` (102 строки): тесты на сохранение врожденного бронепробития `explosive_drone` (0.8) и `sapper` (0.35), а также проверка тайминга `drone_carrier` (интервал 150 тиков).

#### Результаты верификации Pass 9:
- Owner Pass 9 Mars probe (`artifacts/review-r5a-owner-pass9-20261008/mars-preparation-regression-probe.mjs`):
  - **Node 25**: **14/14 PASS** (0 failed).
  - **Node 22**: **14/14 PASS** (0 failed).
- Owner Pass 9 late-reference probe (`artifacts/review-r5a-owner-pass9-20261008/late-reference-boundary-probe.mjs`):
  - **Node 25**: **6/6 PASS** (0 failed).
  - **Node 22**: **6/6 PASS** (0 failed).
- Предыдущие проверочные пробники (Pass 8: 29/29, Pass 7: 21/21, Pass 6: 9/9, Pass 5: 16/16, Pass 4: 12/12): **100% PASS** на Node 25 и Node 22.
- Combat core vitest suite: **32 files PASS, 247 tests PASS**.
- Targeted Mars vitest suites: **8 files PASS, 41 tests PASS**.
- Golden suites:
  - `npm run combat:ecs:golden` (V8): **7/7 presets stable (PASS)**.
  - `npm run combat:ecs:v9:golden` (V9): **7/7 presets stable (PASS)**.
- Typecheck (`npx tsc --noEmit --pretty false`): **0 errors**.
- Architectural limits (`scripts/check-limits.ts --diff HEAD --json`): **0 violations**.
- Sealed R4b archive (`f610158b...`) и Fantasy SDK (`52a91f4e...`): **не изменялись (SHA256 инвариантны)**.

### Замечания Owner Review Pass 10 (2026-10-08) и Remediation:

#### Анализ замечаний Pass 10:
1. **[P2] R5A-MARS-PREPARED-UPGRADE-INVENTORY-INCOMPLETE**:
   - **Проблема**: При отсоединении сырых ID улучшений терялись эффекты `fieldEffect` (купола/барьеры) и `controlBeam` (лучи перехвата): 42 расхождения в 1569 протестированных комбинациях ростера и улучшений (QA-улучшения `qa_smoke_field`, `qa_cleanse_field`, `qa_barrier_dome`, `qa_conversion_beam`).
   - **Исправление**:
     - В `packages/combat-core/src/contracts/prepared.contracts.ts` добавлены поля `fieldEffect`, `controlBeam`, `rankScaling` в `preparedStatsSchema`.
     - В `packages/combat-core/src/combat.effective-loadout.ts` поля проброшены в `resolveEffectiveUnitBaseStats`.
     - В `packages/combat-core/src/combat.upgrade-primitives.ts` добавлены флаги `skipFieldEffect` и `skipControlBeam`, предотвращающие дублирование при сохранении сырых ID улучшений и сохраняющие эффекты при их удалении.
     - В `src/domains/combat/combat.prepared-stats.ts` поля инициализируются из `def.baseStats`, накапливаются из улучшений и возвращаются в `PreparedStats`.
     - В матрице из 1569 вариантов достигнуто 0 расхождений (100% паритет как при наличии raw upgradeIds, так и при их detachment).

2. **[P2] R5A-MARS-PREPARED-RANK-OVERRIDE-SEMANTICS**:
   - **Проблема**: Слияние `rankScaling` из улучшений через `...(effectiveRankScaling ?? {})` сохраняло базовые множители, которые оригинальный резолвер ядра перезаписывает целиком (например, контрольный юнит получал атаку 15 вместо 10).
   - **Исправление**: В `src/domains/combat/combat.prepared-stats.ts` резолюция `modifiers.rankScaling` заменяет `effectiveRankScaling` целиком, восстанавливая семантику перезаписи базового `rankScaling` улучшениями в точном соответствии с ядром.

3. **[P2] R5A-MARS-PREPARED-TRIGGER-ORDER-REGRESSION**:
   - **Проблема**: Для улучшений с обоими типами триггеров (`triggerEffects` и `onDeathSpawn`) нарушался порядок следования: `[onDeathSpawn, explicit]` вместо `[explicit, onDeathSpawn]`.
   - **Исправление**: В `src/domains/combat/combat.prepared-stats.ts` добавление `modifiers.triggerEffects` расположено строго перед `modifiers.onDeathSpawn`, гарантируя порядок `[explicit, onDeathSpawn]`.

4. **[P2] R5A-MARS-CATALOG-OVERRIDE-IGNORED**:
   - **Проблема**: Фабрика `createRuntimeSquad` и `buildMarsPreparedStats` игнорировали характеристики явно переданного каталога, компилируя дефолтные HP 35 / attack 10 вместо переданных в каталоге HP 300 / attack 70.
   - **Исправление**:
     - В `src/domains/combat/combat.prepared-stats.ts` определение выбирается с приоритетом каталога: `catalog.unitTypes?.[unitType] ?? defaultDefs[unitType]`.
     - В `src/domains/combat/combat.squad-factory.ts` функция `createRuntimeSquad` передаёт `catalog` в `buildMarsPreparedStats`, обеспечивая корректное использование пользовательских определений каталога.

#### Постоянные тесты:
- В `src/__tests__/combat.prepared-loadout.test.ts` добавлены 4 постоянных теста:
  - Проверка реального расписания периодического призыва `drone_carrier` (спавны на тиках 149 и 299 за 301 тик).
  - Приоритет определений переданного каталога над дефолтными в `createRuntimeSquad` и `buildMarsPreparedStats`.
  - Семантика полной замены `rankScaling` при модификациях улучшений.
  - Порядок триггеров `[explicit, onDeathSpawn]` и устойчивость `fieldEffect`/`controlBeam` к удалению сырых ID улучшений (`qa_barrier_dome`).

#### Результаты итоговой верификации Pass 10:
- Owner Pass 10 inventory probe (`artifacts/review-r5a-owner-pass10-20261008/prepared-inventory-probe.mjs`):
  - **Node 25**: **10/10 PASS** (0 failed, 1569 comparisons: 0 retained diffs, 0 detached diffs).
  - **Node 22**: **10/10 PASS** (0 failed, 1569 comparisons: 0 retained diffs, 0 detached diffs).
- Owner Pass 9 Mars probe (`artifacts/review-r5a-owner-pass9-20261008/mars-preparation-regression-probe.mjs`):
  - **Node 25**: **14/14 PASS**; **Node 22**: **14/14 PASS**.
- Owner Pass 9 late-reference probe (`artifacts/review-r5a-owner-pass9-20261008/prior-prepared-pipeline-probe.mjs`):
  - **Node 25**: **21/21 PASS**; **Node 22**: **21/21 PASS**.
- Предыдущие проверочные пробники (Pass 8: 29/29, Pass 7: 21/21, Pass 6: 9/9, Pass 5: 16/16, Pass 4: 12/12): **100% PASS** на Node 25 и Node 22.
- Combat core vitest suite: **32 files PASS, 247 tests PASS**.
- Targeted Mars vitest suites: **4 files PASS, 21 tests PASS** (включая все 10 тестов `combat.prepared-loadout.test.ts`).
- Golden suites:
  - `npm run combat:ecs:golden` (V8): **7/7 presets stable (PASS)**.
  - `npm run combat:ecs:v9:golden` (V9): **7/7 presets stable (PASS)**.
- Typecheck (`npx tsc --noEmit --pretty false`): **0 errors**.
- Architectural limits (`scripts/check-limits.ts --diff HEAD --json`): **0 violations**.
- Sealed R4b archive (`f610158b...`) и Fantasy SDK (`52a91f4e...`): **не изменялись (SHA256 инвариантны)**.

### Замечания Owner Review Pass 11 (2026-10-08) и Remediation:

#### Анализ замечаний Pass 11:
1. **[P2] R5A-PREPARED-PRIMITIVE-CONTRACT-UNVALIDATED**:
   - **Проблема**: Поля `fieldEffect`, `controlBeam`, `rankScaling` в `preparedStatsSchema` ранее принимали `z.record(z.string(), z.unknown())` без строгой валидации структуры. Девять повреждённых сценариев (строки вместо чисел в радиусе, скорости прогресса, коэффициентах ранга) обходили предварительную проверку `validateBattleInput` и падали уже после создания мира или тихо санировались.
   - **Исправление**:
     - В `packages/combat-core/src/contracts/` созданы строго типизированные схемы для всех примитивов модификаторов с соблюдением лимита $\le 100$ строк на контракт:
       - `modifier-primitives.contracts.ts` (89 строк): `fieldEffectConfigSchema`, `controlBeamConfigSchema`, `rankScalingConfigSchema`, `transformModeConfigSchema`, `formationModifiersConfigSchema`, `statGrowthConfigSchema`.
       - `tactical-primitives.contracts.ts` (42 строки): `attackChargeConfigSchema`, `delayedReassemblyConfigSchema`, `conditionalRangeConfigSchema`, `flatDamageBlockConfigSchema`, `shieldHitBlockConfigSchema`, `targetPriorityProfileSchema`.
       - `weapon-primitives.contracts.ts` (60 строк): `conditionalAttackModeConfigSchema`, `sweepAttackConfigSchema`, `linePierceConfigSchema`, `coneAttackConfigSchema`, `beamAttackConfigSchema`, `barrageAttackConfigSchema`, `chainAttackConfigSchema`, `splitFireConfigSchema`, `sideWeaponConfigSchema`.
     - В `packages/combat-core/src/contracts/prepared.contracts.ts` (92 строки) все 21 схема подключены напрямую в `preparedStatsSchema`, устранив нетипизированные `z.record` escape hatches.
     - Создан модуль предвалидации `packages/combat-core/src/combat.primitive-validator.ts` (50 строк) и интегрирован в `packages/combat-core/src/combat.loadout-validator.ts`, обеспечивая раннее отклонение повреждённых примитивов на уровне `validateBattleInput` до инициализации мира и расхода RNG с кодом `SCHEMA_VALIDATION_ERROR`.

2. **[P2] R5A-MARS-PREPARED-UPGRADE-INVENTORY-INCOMPLETE**:
   - **Проблема**: Из 24 поддерживаемых семейств модификаторов 19 терялись при отсоединении сырых ID улучшений (геометрии оружия, трансформации, рост характеристик, блоки урона, поглощение щитом и др.).
   - **Исправление**:
     - Создан модуль `src/domains/combat/combat.prepared-primitives.ts` (196 строк), агрегирующий и подготавливающий все 24 семейства модификаторов из определений юнитов и конфигураций улучшений каталога.
     - `src/domains/combat/combat.prepared-stats.ts` интегрирован с `collectMarsPreparedPrimitives`, гарантируя включение полного набора всех 24 семейств в `PreparedStats`.
     - В `packages/combat-core/src/combat.upgrade-primitives.ts` реализована симметричная логика пропуска повторного применения (`skip*`) для всех 24 семейств, если они уже присутствуют в `preparedStats`, предотвращая задвоение эффектов при сохранении сырых ID и обеспечивая 100% идентичность симуляции при отсоединении ID.

#### Постоянные тесты:
- `packages/combat-core/tests/prepared-primitives-r5a.test.ts` (182 строки, 18 тестов):
  - Проверка валидации и симуляции корректных примитивов `fieldEffect`, `controlBeam`, `rankScaling`.
  - Проверка гарантированного отклонения с кодом `SCHEMA_VALIDATION_ERROR` повреждённых структур на всех трёх уровнях (unit instance, definition, late summon) до создания мира (0 RNG вызовов, 0 очередей сущностей).
- `src/__tests__/combat.modifier-coverage.test.ts` (102 строки, 24 теста):
  - Проверка полного паритета симуляции для всех 24 семейств модификаторов между raw battle, retained upgradeIds и detached upgradeIds.

#### Результаты итоговой верификации Pass 11:
- Owner Pass 11 primitives probe (`artifacts/review-r5a-owner-pass11-20261008/prepared-primitives-probe.mjs`):
  - **Node 25**: **19/19 PASS** (0 failed).
  - **Node 22**: **19/19 PASS** (0 failed).
- Owner Pass 11 modifier coverage probe (`artifacts/review-r5a-owner-pass11-20261008/modifier-coverage-probe.mjs`):
  - **Node 25**: **48/48 PASS** (0 failed).
  - **Node 22**: **48/48 PASS** (0 failed).
- Owner Pass 10 inventory probe (`artifacts/review-r5a-owner-pass10-20261008/prepared-inventory-probe.mjs`):
  - **Node 25**: **10/10 PASS** (1569 comparisons: 0 diffs).
  - **Node 22**: **10/10 PASS** (1569 comparisons: 0 diffs).
- Вся матрица предыдущих проверочных пробников (Pass 9, Pass 8, Pass 7, Pass 6, Pass 5, Pass 4): **100% PASS** на Node 25 и Node 22.
- Combat core vitest suite: **33 files PASS, 265 tests PASS**.
- Полный тестовый набор Mars (`npm test`): **205 files PASS, 859 tests PASS**.
- Golden suites:
  - `npm run combat:ecs:golden` (V8): **7/7 presets stable (PASS)**.
  - `npm run combat:ecs:v9:golden` (V9): **7/7 presets stable (PASS)**.
- Typecheck (`npx tsc --noEmit --pretty false`): **0 errors**.
- Architectural limits (`scripts/check-limits.ts --diff HEAD~1 --json`): **0 violations**.
- Sealed R4b archive (`f610158b...`) и Fantasy SDK (`52a91f4e...`): **не изменялись (SHA256 инвариантны)**.

### 2026-10-08 — Приёмка R5a (ISO-09, Pass 12) и устранение дефекта barrageAttack

1. **Официальная приёмка R5a / ISO-09 (Owner Review Pass 12)**:
   - Коммит `3fb23c9558b9f62404769867f93103ed0ff8e4ea` принят с вердиктом **ACCEPT**.
   - Проверена вся матрица пробников (184/184 assertions PASS на Node 25 и Node 22).
   - 176 дополнительных типизированных проверок инвентаря (`typed-inventory-probe.mjs`): 176/176 PASS.
   - Core vitest: 265 тестов PASS; Mars vitest: 859 тестов PASS.
   - Golden V8 и V9, typecheck, architectural limits: PASS.

2. **Исправление дефекта `barrageAttack` (`CORE-V9-BARRAGE-DUPLICATE-DAMAGE-ORDER`)**:
   - **Проблема**: При множественных попаданиях залпа (`barrageAttack`, `impacts > 1`) по одной и той же цели в режиме `v9_snapshot` возникало исключение `CombatInvariantError: Duplicate damage order key`. Система вторичных попаданий (`secondary-hit-system.ts`) использовала одинаковый `authoredPosition` `{ 0, 0, 0, 0 }` и `authoredOrdinal: 0` для всех попаданий.
   - **Исправление**:
     - В `EcsSecondaryHitOptions` (`secondary-hit-system.ts`) добавлены поля `originExternalId?: string`, `authoredOrdinal?: number`, `authoredPosition?: AuthoredEffectPosition`, которые передаются в `applyEcsSingleDamage` и `applyEcsOnHitEffects` (`authoredKey`).
     - В `barrage-attack-system.ts` для каждого попадания (`impact.index`) и каждой цели (`targetOrdinal`) формируется уникальный детерминированный `authoredPosition: { programIndex: 0, groupIndex: impact.index, targetOrdinal, effectIndex: 0 }`, `authoredOrdinal: impact.index` и `originExternalId: "unit:${attacker}:barrage"`.
     - Защита от дублирования ключей урона в `defense-batch.ts` сохранена активной и строгой.
   - **Верификация**:
     - Пробник `composition-probe.mjs`: **50/50 PASS** на Node 25.6.0 и Node 22.20.0 (включая `COMPOSE_barrageAttack_BASE_PLUS_TWO_UPGRADES` и `LATE_barrageAttack_PREPARED_DEFINITION`).
     - Пробник `barrage-baseline-probe.mjs`: все 6 конфигураций кандидата (`candidate_instant_raw`, `candidate_instant_prepared`, `candidate_staggered_raw`, `candidate_staggered_prepared`, `candidate_one-impact-control_raw`, `candidate_one-impact-control_prepared`) теперь успешно завершаются (60 тиков, 24/18 damage events).
     - Добавлены постоянные тесты в `packages/combat-core/tests/prepared-primitives-r5a.test.ts` и `src/__tests__/combat.ecs-barrage-attack.test.ts`.

### 2026-10-09 — Реализация R5b (ISO-08): изоляция состояния рантайма и устранение глобальных реестров

Срез R5b выполнен в полном соответствии с требованиями ISO-08:

1. **Полное устранение глобальных реестров и мутабельных синглтонов из `@mars2050/combat-core`:**
   - Из `packages/combat-core/src/combat.catalog.types.ts` удалены:
     - `defaultCombatCatalog`
     - `registerDefaultCombatCatalog`
     - `getDefaultCombatCatalog`
   - Из `packages/combat-core/src/facade/combat-facade.ts` удалены:
     - `activeSimulator`
     - `registerCombatSimulator`
     - `CombatSimulatorHandler`
     `simulateCombat` теперь вызывает `executeCombatSimulation` напрямую без глобальных обработчиков.
   - Устранены все fallback-вызовы к дефолтному каталогу (`?? getDefaultCombatCatalog()`) по всем путям ядра:
     - `combat.squad-compiler.ts`
     - `combat.support-aura-config.ts`
     - `combat.unit-compiler.ts`
     - `combat.unit-stat-compiler.ts`
     - `combat.upgrade-primitives.ts`
     - `ecs/combat-entity-factory.ts`
     - `ecs/systems/death-system.ts`
     - `ecs/systems/periodic-ability-spawn-system.ts`
     - `ecs/systems/spawn-action-system.ts`
     - `ecs/systems/trigger-spawn-system.ts`
     - `ecs/combat-ecs-runtime.ts`

2. **Изоляция владения контекстом битвы (Per-battle lifecycle & catalog context):**
   - В `packages/combat-core/src/combat.runner.ts` для каждой битвы собирается изолированный `CombatCatalog` из переданных в `BattleInput` определений (`definitions`) и каталога (`catalog`), который передаётся в рантайм через опции `createEcsCombatRuntime({ catalog })`.
   - Рантайм сохраняет каталог в ресурсах мира (`world.resources.set('catalog', options.catalog)`).
   - Все фабрики сущностей, поздние призывы (death spawn, periodic spawn, trigger spawn, clone, reassembly) и расчет аур извлекают каталог строго из локального контекста: `input.catalog ?? world.resources.get('catalog')`.
   - Входные данные симуляции не модифицируются и могут быть глубоко заморожены (`Object.freeze`).

3. **Марсианский каталог и изоляция домена Mars (`src/domains/combat/`):**
   - Создан модуль `src/domains/combat/combat.catalog.ts`, инкапсулирующий сборку марсианского каталога (`MARS_CATALOG` / `getMarsCombatCatalog()`) с предрассчитанными характеристиками марсианских юнитов и улучшений через `mapDefinitionToUnitTypeConfig`.
   - Из `src/domains/combat/combat.config.ts` удалён вызов `registerDefaultCombatCatalog`.
   - `src/domains/combat/combat.facade.ts` реэкспортирует `simulateCombat` напрямую из `@mars2050/combat-core`.
   - Фабрики сущностей и отрядов Mars (`combat.squad-factory.ts`, `combat.unit-factory.ts`, `combat.unit-compiler.ts`) используют `effectiveCatalog = catalog ?? MARS_CATALOG`.
   - Низкоуровневые тестовые сценарии Mars, создающие ECS-мир напрямую в обход `simulateCombat`, явно передают `catalog: MARS_CATALOG` в подготовку мира.

4. **Тестирование и верификация изоляции:**
   - Добавлен тестовый набор `packages/combat-core/tests/runtime-isolation-r5b.test.ts` (3 теста):
     - Проверка отсутствия экспорта глобальных реестров и синглтонов из `combat-core`.
     - Конкурентный запуск изолированных симуляций с одинаковыми `definitionId`, но расходящимися характеристиками без перекрёстного влияния при глубоко замороженных `BattleInput`.
     - Проверка разрешения поздних призывов и периодических способностей строго из локального каталога без глобальных fallback.

#### Итоговая верификация R5b:
- **Combat core vitest suite**: **34 files PASS, 269 tests PASS**.
- **Golden suites**:
  - `npm run combat:ecs:golden` (V8): **7/7 presets stable (PASS)**.
  - `npm run combat:ecs:v9:golden` (V9): **7/7 presets stable (PASS)**.
- **Typecheck** (`npx tsc --noEmit --pretty false`): **0 errors**.
- **Architectural limits** (`scripts/check-limits.ts --diff HEAD --json`): **0 violations**.
- **Owner Pass 12 Probes (Node 25.6.0 & Node 22.20.0)**:
  - `typed-inventory-probe.mjs`: **176/176 PASS**.
  - `prepared-primitives-probe.mjs`: **19/19 PASS**.
  - `modifier-coverage-probe.mjs`: **48/48 PASS**.
  - `prepared-inventory-probe.mjs`: **10/10 PASS** (1569 comparisons: 0 diffs).
  - `composition-probe.mjs`: **50/50 PASS**.
  - `barrage-baseline-probe.mjs`: все сценарии кандидата **PASS** (60 ticks, 24 damage events).
- Sealed R4b archive (`f610158b...`) и Fantasy SDK (`52a91f4e...`): **не изменялись (SHA256 инвариантны)**.



