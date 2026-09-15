# Combat-core: план исправления изоляции и повторной приёмки

Дата: 2026-09-14. Статус: `planned`; исправления R0–R7 не начаты этим документом.

Цель: довести уже выделенный пакет до реальной независимости, исправить ошибки его публичного API и повторно доказать совместимость Mars. Выполнение — малыми срезами через gauntlet-loop с проверкой самих тестов и независимым ревью.

Это корректирующий план к [extraction E0–E7](combat-core-extraction-plan.md), а не повторный перенос движка. Архитектурные инварианты исходного плана и [ADR-015](../.project/adrs/015-combat-core-package-boundary.md) сохраняются. Для корректирующего запуска порядок, baseline и критерии берутся из этого документа, а не из исторического задания начать extraction от `master`.

## 1. Исходная точка и границы

- Проверенная рабочая ветка: `feat/combat-core-extraction`, HEAD `180e3d1`; при подготовке плана tracked/untracked изменений не было. При запуске заново проверить фактическое состояние и записать полный SHA.
- Исторический Mars baseline: `0097e7d777582be8ea45319f66edae1cf910e6b0`. Он нужен для сравнения поведения, а не как новая база для повторного написания пакета.
- Аудит 2026-09-13: после ручной сборки core прошли 812 тестов в 201 файле, TypeScript, полный architecture scan и существующий archive smoke. Windows / Node 25.6.0; clean CI и Node 22 Windows/Linux + Chromium этим не подтверждены.
- Приёмка в [старом журнале](combat-core-progress.md) не закрывает найденные нарушения. Сохранить её как историю; новые доказательства вести отдельно в `docs/combat-core-isolation-progress.md`.
- Не откатывать extraction, не переключаться на terrain-ветку, не создавать вторую поддерживаемую реализацию runtime. Исправления вести поверх фактического extraction HEAD в согласованной repair-ветке.
- В scope: core, Mars adapter, Fantasy fixtures, тесты, упаковка, CI и документация границ. Вне scope: Fantasy UI/экономика, новые боевые механики, изменение баланса/порядка фаз/PRNG, replay canonicalization, сокращение diagnostics, миграции БД и публикация пакета.
- Создание плана не является разрешением начать реализацию, коммитить или публиковать изменения. При отдельном запуске согласовать локальные изменения/checkpoints, владельца записи, доступ к reviewer и наблюдаемый бюджет. Push/PR/merge/deploy/registry и платные сервисы требуют отдельного разрешения.

## 2. Реестр нарушений и критерии закрытия

Наблюдения относятся к проверенному HEAD, а не автоматически к будущей ветке. R0 подтверждает их заново. Один зелёный тест не закрывает другие строки реестра.

| ID | Проблема / исходная точка | Закрывающая проверка | Срез |
| --- | --- | --- | --- |
| ISO-01 | `statusOnHit` и `healTargetTags` теряются в [definition mapper](../packages/combat-core/src/combat.definition-mapper.ts) | Реальные `status_apply` + последующий burn damage; лечение разрешённой цели и отказ запрещённой | R2a |
| ISO-02 | В том же mapper `beam`/`spread` молча превращаются в `single` | Каждый принимаемый тип имеет проверенное исполнение; неподдерживаемый тип даёт явную ошибку, не другую атаку | R2a |
| ISO-03 | [Runner](../packages/combat-core/src/combat.runner.ts) превращает `attacker_win` в ничью | Все три timeout-политики возвращают точный winner, reason и elapsedTicks; terminal outcome не подменяется timeout | R2b |
| ISO-04 | Runner отбрасывает `scheduledEffects.tick` | Эффект срабатывает ровно в переданный tick, не раньше и не повторно; legacy timing Mars сохранён | R2b |
| ISO-05 | [Spawn compiler](../packages/combat-core/src/combat.spawn-spec-compiler.ts) молча удаляет неизвестное определение | Вход отклонён до создания мира/расхода RNG; нет фиктивного результата с победителем | R3a |
| ISO-06 | Там же seeded-размещение использует фиксированные 320 единиц | Все начальные позиции на допустимой арене, включая 100×100; прежние Mars координаты и PRNG совпадают | R3b |
| ISO-07 | [Root scripts](../package.json) и [CI](../.github/workflows/ci.yml) не готовят `dist` до потребителей | Чистый checkout без старого `dist`: установка, typecheck, тесты, dev/build и replay smoke | R1, R7 |
| ISO-08 | [Production exports](../packages/combat-core/package.json) открывают ECS и все внутренние модули | Закрытый allowlist; реальные существующие внутренние subpaths дают `ERR_PACKAGE_PATH_NOT_EXPORTED` | R6 |
| ISO-09 | [Unit compiler](../packages/combat-core/src/combat.unit-compiler.ts) зависит от `alien_`; есть глобальные catalog/simulator registries | Traits заданы данными; все пути создания используют контекст боя; чередование игр с совпадающими definition ID изолировано | R5 |
| ISO-10 | Runner возвращает raw ECS через `profile.__marsCompat`; [compat mapper](../src/domains/combat/combat.compat-mapper.ts) обходит DTO | Явный рабочий wire-кодек, неизменный legacy JSON, отсутствие raw ECS/скрытого compat-канала | R4a |
| ISO-11 | Нет отдельных contract/ruleset/replay identities | Проверенные metadata обоих потребителей; engine build и правила различаются без изменения legacy compatibility identifiers | R4b |
| ISO-12 | [Fantasy matrix](../examples/fantasy-combat/src/run-battle.ts) допускает warning вместо проверки механики | Проверяется наблюдаемое действие/состояние; отключение механики делает соответствующий тест красным | R2–R3, R7 |
| ISO-13 | [Archive smoke](../scripts/test-combat-package.ts) не запускает бой, а отрицательный импорт проверяет неверный путь | Настоящие runtime-fixtures из установленного архива; строгие export guards; Node/browser parity | R1, R6–R7 |

## 3. Последовательность работ

```text
R0 baseline → R1 clean build + ранний runtime smoke
  → R2a abilities → R2b rules → R3a validation → R3b placement
  → R4a wire boundary → R4b identities
  → R5a explicit content/traits → R5b per-battle ownership
  → R6 closed exports → R7 independent certification
```

Это порядок по умолчанию. Каждый подэтап — отдельный проверяемый срез, не обязательно отдельный PR. Изменение зависимости требует записи причины и сохранения всех критериев; не объединять compiler, serializer и export migration в один непроверяемый коммит.

### R0 — восстановить достоверную исходную точку

Работы:

1. Прочитать AGENTS, исходный план, этот документ, ADR-013/014/015 и старый журнал. Проверить Git/files/process state; не менять общую рабочую копию параллельно с другим писателем.
2. Зафиксировать extraction HEAD и доступность исторического baseline. Если появились новые коммиты, исследовать их diff; не переносить автоматически старый вердикт. Не делать merge/rebase `master` ради начала ремонта.
3. Сохранить минимальные воспроизводители ISO-01–06 и проверки ISO-07–13: вход, seed, команда, наблюдаемый результат, snapshot. Функциональный FAIL не заменять ошибкой импорта или неподготовленной сборки.
4. Зафиксировать неизменяемые Mars fixtures и полные результаты: V8/V9, Tier1, PR10–PR15, globals, частично заданные координаты, все spawn-пути, clone/reassembly, persistence/replay. Если доказательства E0 отсутствуют, восстановить их из исторического commit в ограниченном временном/CI checkout.
5. Составить inventory production/test imports, публичных полей и callers; отдельно выяснить наличие внешних потребителей экспериментального API. Подготовить таблицу `поле схемы → преобразование → исполнитель → тест`.
6. Создать новый журнал со всеми ISO в `open`; финальное состояние extraction — `needs_revision`. В старом журнале допустима датированная ссылка на переоткрытие, без удаления прежних записей.

Приёмка R0: baseline и воспроизводители доступны, конкретные пробелы отмечены `FAIL`/`NOT_RUN`, границы известны. Это приёмка аудита, не исправлений: исторический FAIL остаётся открытым. Постоянный regression-тест каждого дефекта вводится в его R-срезе и должен пройти red→green до приёмки этого среза.

### R1 — чистая сборка и ранний настоящий архивный потребитель

Работы:

- Сделать сборку core обязательной до root typecheck, тестов, dev и production build. В CI явно выполнить её после `npm ci`; не рассчитывать на закоммиченный/закэшированный `dist` или ручной шаг разработчика.
- Добавить root-команду typecheck с корректной подготовкой зависимостей; прямой `npx tsc` остаётся проверкой уже подготовленного дерева. Обновить инструкции запуска и root scripts без рекурсивного вызова build.
- Устранить привязку package harness к `npm.cmd`/`tsc.cmd`: корректно выбирать команды для Windows/Linux. Не менять версии стека или менеджер пакетов.
- Ввести собственный Node test/typecheck core, без jsdom, Mars setup и app env; сохранить все прежние проверки Mars. Не дублировать запуск одинаковых тестов случайно через два Vitest-конфига.
- Отдельно от исторического schema smoke запускать из архива настоящий melee-бой и in-combat summon: ненулевые атаки/урон, правильное создание существа и owner/source, повторный seed и JSON round-trip. Использовать явные позиции; это не доказательство seeded placement или остальных механик.
- Уже этот ранний потребитель получает только tarball, собственные fixtures и declared dependencies, без `NODE_PATH`, aliases и workspace symlinks. Проверить фактические пути разрешённых модулей; R7 расширяет ту же изолированную проверку, а не впервые вводит независимость окружения.
- Исправить отчётность: старый неправильный отрицательный импорт не может выдавать «изоляция подтверждена». До R6 проверка реальных internals честно показывает известный `FAIL` ISO-08; ранний runtime smoke имеет отдельный результат. Это не разрешение пропускать export guard при финальной приёмке.

Приёмка R1: свежий source snapshot можно подготовить и проверить документированными командами; минимальный runtime и summon работают у внешнего потребителя. Неготовность закрытых exports и полной matrix остаётся явно открытой. Полный clean Next/replay/cross-platform gate повторяется в R7.

### R2a — публичные definitions действительно исполняются

- Провести `statusOnHit`, `healTargetTags` и все уже объявленные поля через схему, mapper, compiler, entity creation и in-combat creation без потерь. Не заменять точные типы cast к внутреннему каталогу.
- Burn fixture гарантирует возможность атаки: зафиксированы range, позиции, cooldown, HP и длительность. Проверить `status_apply`, корректную цель, последующий status damage и отличие от контрольного боя без burn.
- Healer fixture содержит заранее повреждённых союзников с разрешёнными и запрещёнными tags. Проверить событие лечения и изменение HP разрешённой цели, исключение запрещённой и ограничение max HP.
- Для всех принимаемых attack types исключить silent coercion. Уже поддерживаемые механики подключить к существующим primitives; если для `beam`/`spread` в текущем API нет однозначного представления, явно отклонять их как unsupported и версионировать экспериментальный контракт. Не писать новый beam/spread движок и не вырезать обязательные burn/heal/summon сценарии.
- Убрать warning вместо assertions в затрагиваемых Fantasy-сценариях. Enum/field coverage включить в regression, чтобы новое поле схемы не считалось реализованным только из-за успешного parse.

Приёмка: публичный фасад и архивный потребитель подтверждают реальные эффекты; локальный контрольный возврат потери поля ломает тест. Mars baseline не меняется.

### R2b — timeout и scheduled effects как данные

- Явно и полно сопоставить `draw`, `attacker_win`, `defender_win`. Не менять момент terminal checks, ожидание pending impacts/hazards/reassembly или порядок фаз.
- Сохранить `tick` при всех преобразованиях и исполнении каждого поддерживаемого scheduled effect, включая shield. Прежние моменты shield/EMP/strike/heal задаёт Mars adapter, а не скрытые defaults ядра.
- Проверить tick 0, 1, 5, исторический tick и событие за пределами maxTicks; запрет раннего/повторного срабатывания, порядок одинаковых ticks, цели, source attribution и расход RNG.
- Unknown effect kinds и недопустимый payload должны отклоняться, а не превращаться в no-op.

Приёмка: таймаутная матрица и точные effect ticks проходят через публичный API/архив; Mars globals и outcome regression полностью совпадают.

### R3a — валидация полного входа до симуляции

- Использовать Zod `safeParse` с проверками ссылочной целостности до создания world и первого обращения к RNG. Структурной схемы отдельных объектов недостаточно.
- Проверять definition IDs, уникальность instance IDs и итоговых squad-member IDs, согласованность ключа каталога с ID определения, spawn/upgrade/ability/profile references и поддерживаемые комбинации. Правила разрешённых summon-циклов брать из существующих ограничений, не запрещать поддерживаемую механику без разбора.
- Проверять числовые диапазоны, размеры, duration/tick, координаты и payload; недопустимый input не должен тихо удалять отряд, обнулять эффект или возвращать победителя.
- Зафиксировать типизированную ошибку с `code`, путём поля и проблемной ссылкой. Invalid input не является `CombatRunResult`; нарушение внутреннего инварианта не маскируется под пользовательскую ошибку.
- Поведение старой Mars-обёртки на некорректных DB/config данных сначала охарактеризовать; при необходимости сохранить его явным compatibility mapping снаружи строгого ядра. Изменение экспериментальной сигнатуры отражать в версии контракта и обоих callers; для обнаруженных внешних потребителей согласовать миграцию.

Приёмка: позитивные и негативные fixtures, отсутствие расхода RNG/частичного мира при ошибке, одинаковые коды ошибок для JSON-входа. Каждая неизвестная ссылка обнаруживается до боя, в том числе ссылка, используемая только при позднем summon.

### R3b — нейтральное seeded-размещение и границы арены

- Убрать неявную полосу 320 из общего compiler. Mars передаёт прежнюю область/стратегию как данные; нейтральный default использует размеры конкретной арены. Сохранить один PRNG боя и прежний порядок X/Y/членов отряда.
- Проверить заданные обе координаты, только X, только Y и обе отсутствующие. Для legacy Mars результаты и следующие значения RNG должны совпасть с baseline.
- Проверить арену 100×100, Mars 600×1200 и другую допустимую арену; single/squad, края, body size/formation offsets, obstacles и призыв у границы. Невместимый squad/невалидная область требуют явной ошибки, не размещения снаружи и не бесконечного resampling.
- Проверить оставшиеся arena/physical assumptions в pathfinding, packed-cell keys, spatial queries и создании тел; параметры мира приходят из контекста, технические допуски документированы. Простое ограничение координат в выходном DTO не исправляет внутреннюю геометрию и не считается прохождением проверки.
- Политику для явных координат вне арены определить до исправления и проверить. Не вводить общий clamp, меняющий стандартные Mars fixtures; историческую совместимость обрабатывать в адаптере.

Приёмка: начальное состояние и новые сущности удовлетворяют согласованным границам, формация не теряет участников; стандартные Mars координаты, порядок RNG и replay не меняются.

### R4a — реальная DTO/wire-граница до новых runtime traits

- Составить полный inventory полей, которые нужны legacy replay, persistence и renderer, включая optional/отсутствующие значения и порядок JSON. Не ограничиваться текущим сокращённым `CombatReplayUnit`.
- Ввести явный сериализуемый snapshot/event contract, достаточный обоим потребителям. Он может быть подробным, но не является `SimUnit`, store или автоматически скопированным набором компонентов.
- Подключить явный codec в реальном пути `simulateCombat → Mars compatibility mapper → persistence/replay`. Удалить `profile.__marsCompat`, raw fallback и casts сокращённых DTO в `SimUnit`; просто удалить compat-поле без замены запрещено.
- `profile: false` не возвращает raw state или profiling payload. Недетерминированное время отделено от deterministic result; список исключаемых timing-полей фиксируется заранее.
- В regression добавить внутреннее служебное поле/sentinel и доказать, что оно не появляется во внешнем JSON. Реальные gameplay-поля, события и их порядок фильтром не скрывать.

Приёмка: точный legacy JSON относительно исторических fixtures, old/current/future/revision-mismatch replay, PvP/PvE persistence и renderer работают через DTO. Эту границу принять до R5, чтобы новые traits не протекали в replay.

### R4b — раздельные identities

- Развести версию публичного контракта, identity сборки engine, `ruleset ID/version/content hash` и replay schema identity. Документировать происхождение каждого поля и поведение при несовместимости.
- Hash относится к сериализуемым подготовленным данным по определённому правилу; он не сортирует боевые входы/события и не заменяет differential comparison. Один и тот же архив должен иметь одну engine identity во всех проверяемых средах.
- Legacy `simulationVersion`, `simulationRevision`, `snapshot.version`, `metrics.engineRevision` сохраняет Mars compatibility layer. Не повышать их для сокрытия регрессии.
- Новые metadata разместить в совместимом конверте только после проверки читателей. Не начинать миграцию БД без отдельного решения.

Приёмка: один engine с двумя rulesets имеет разные content identities; восстановление из JSON сохраняет metadata. Старые Mars replay проходят прежние контракты.

### R5a — весь игровой контент и traits вне ядра

Внутреннее разбиение: подготовленные starting definitions → traits/targeting → rank/upgrade/loadout compilation. Каждый переход имеет отдельный differential checkpoint; R5a не принимается по одному исправленному префиксу.

- Перенести `alien_`-эвристики, игровые defaults, rank/upgrade resolution, support auras и преобразования единиц Mars в его adapter/config. Передавать ядру подготовленные типизированные определения/модификаторы и явные traits.
- Проверить все поля по inventory R0; public schema/mapper должны поддерживать и валидировать используемые обоими адаптерами механики, без `catalog: Record<string, unknown>` как обхода границы.
- Одинаковые stats/traits при одинаковых instance IDs, порядке и seed дают одинаковое механическое поведение для разных definition names. Согласованно переименовать ссылки и сравнить поведение; естественное изменение ID в output не является дефектом. Не заявлять произвольную instance-ID/permutation invariance.
- Убедиться, что core больше не ищет игровые каталоги, имена юнитов/улучшений, стоимости, DB-поля или марсианские единицы. Defaults механических алгоритмов допустимы только как нейтральный документированный контракт.

### R5b — только per-battle состояние, без глобальных registries

Разбивать проверки по путям: initial creation → action/periodic spawn → trigger/death spawn → clone/reassembly. Последний путь нельзя считать проверенным на основании предыдущего.

- Удалить `defaultCombatCatalog`, `registerDefaultCombatCatalog`, изменяемый `activeSimulator` и регистрацию движка через импорт Mars. Обычный facade напрямую использует единственную реализацию; необходимость будущего dependency injection не оправдывает глобальный setter.
- Создать полный контекст до runtime initialization. Передать его во все starting/action/periodic/trigger/death spawn, clone, reassembly, aura, targeting и upgrade compilation paths. Не оставлять fallback к default catalog.
- Игровые определения неизменяемы; таймеры, заряды, эффекты и кэши принадлежат конкретному бою/сущности. Общие кэши по одному definition ID запрещены.
- Проверить deep-frozen input, повторное использование тех же объектов, mutation isolation между юнитами, Mars→Fantasy→Mars и обратный порядок. В обеих играх намеренно совпадают definition IDs, но различаются stats/abilities; отдельно проверить поздний summon и чередование арен.

Приёмка R5: отсутствие глобальных content/runtime setters и игровых эвристик подтверждено dependency/code audit и исполняемыми тестами. Все пути создания включены в evidence; один стартовый бой не закрывает spawn/reassembly.

### R6 — закрытые exports и миграция потребителей

- По inventory R0 перевести production callers на facade/DTO и только действительно нужные нейтральные helpers. Удалить wrappers, открывающие runtime internals; нужные диагностические тесты перенести внутрь пакета или на документированный test-only resolver.
- Production `exports` — явный allowlist, без `./*`, `./ecs`, `./ecs/*`. Нужные math/replay subpaths перечисляются и ревьюятся; `CombatWorld`, stores, compiler bundles, defense mutation functions и регистрационные setters не становятся публичным API.
- Test-only доступ не публикуется ни отдельным export, ни package condition, ни самостоятельным скрытым entry point. Ни production imports, ни TypeScript paths не обходят границу через исходники пакета.
- Проверять JS и транзитивный граф публичных `.d.ts`: отсутствие Mars/Next/React/Supabase/DB и ECS types. Проверять реальное разрешение импортов, а не только поиск строк `@/`.
- Отрицательные Node-тесты пробуют существующие внутренние модули из установленного архива, включая `ecs/combat-world`, `combat.unit-compiler`, `ecs/defense-resource-commit`; принимается именно `ERR_PACKAGE_PATH_NOT_EXPORTED`, не любой catch/`MODULE_NOT_FOUND`. Положительные exports проверяются рядом.
- Сохранить architecture limits, защиту `COMBAT_DEFENSE_MUTATION` и regression-тесты guards; дополнить проверкой обхода package boundary.

Приёмка: Mars production и полный набор diagnostics работают без открытых ECS exports. Реальные private imports запрещены, а временное открытие одного subpath делает guard красным. Архив не включает app sources, test fixtures, test entry points или новые undeclared runtime deps.

### R7 — независимая сертификация и финальное ревью

- Создать один `npm pack`-артефакт из проверенного snapshot, сохранить полный SHA256. Передавать именно этот архив всем потребителям матрицы, не пересобирать незаметно другой пакет на каждом runner.
- В чистом каталоге/CI job, где доступны только архив и самостоятельные consumer fixtures, установить declared dependencies. Убрать `NODE_PATH`, root aliases, workspace symlinks, app env и возможность импорта исходников Mars. Проверить JS runtime и собственный TS consumer без подавления ошибок деклараций.
- Прогнать melee, burn/status, heal/tag filtering, summon/owner/source/caps, существующее death/reassembly, все timeout policies, scheduled ticks, unknown refs, obstacles, random/explicit placement, две арены, frozen input, round-trip и чередование rulesets. Реализацию fixtures не дублировать вручную между Node и browser.
- Выполнить одинаковые fixtures на Node 22 Windows, Node 22 Linux и Chromium с настоящей client bundle сборкой. Записать точные Node/npm/OS и browser version. Сравнить результаты, события, порядок, координаты и metadata без сортировки/округления; исключения только для заранее названных timing-полей.
- В отдельных clean jobs проверить Mars `npm ci → core build → typecheck/test/lint/limits → Next production build → replay smoke`, V8/V9/Tier1 и inventory PR10–PR15. Изменение core должно запускать и consumer, и Mars jobs; нужные jobs не скрываются path filters.
- Повторить пять прогретых A/B прогонов `massive_clash`/`zerg_rush` в одинаковом окружении: production/profile, структурные счётчики, bundle size. Необъяснённая устойчивая регрессия медианы >10% требует разбора; разные CI runners не сравнивать по абсолютному времени.
- Отдельный reviewer проверяет все ISO, исходную Definition of Done и финальный snapshot, включая отсутствие второй реализации, непроверенных путей и снятых guards. Актуализировать ADR/AGENTS/llm-context и карту запусков по факту.

Приёмка: все ISO закрыты конкретным evidence; отсутствующие Linux/Chromium/clean-build/reviewer проверки остаются `NOT_RUN`/`BLOCKED`. Локальный Node 25 или согласие автора не заменяют матрицу. Только после этого финальный статус может стать `completed`; merge всё равно требует разрешения.

## 4. Gauntlet-loop одного исправления

Роли: один координатор/писатель; настоящий отдельный read-only reviewer в свежем контексте. Другая модель полезна, но не обязательна; повторная самооценка той же сессии не является независимым ревью. Если среда не даёт второго проверяющего, подготовить review bundle и остановиться на `needs_external_review` до зависимых срезов.

1. **Select.** Выбрать один ISO/подэтап с принятыми зависимостями. До кода записать вход, наблюдаемое поведение, ожидаемый результат, разрешённые файлы, запреты и обязательные gates. Не менять критерий после получения неудобного результата.
2. **Red.** Добавить содержательный regression-тест и запустить на версии до фикса со свежим `dist`. Сохранить конкретный failure, seed, command и hash теста. Ошибка подготовки окружения не доказывает воспроизведение gameplay-дефекта.
3. **Fix.** Исправить минимальный путь; эталоны Mars и ожидаемое поведение regression-теста не переписывать. Разделение большого среза допустимо с явными зависимостями.
4. **Freeze.** Остановить запись в проверяемые исходники. Snapshot: полный HEAD + staged/unstaged binary diff hashes + manifest/hashes task-scoped untracked файлов, либо чистый commit. Включить код, тесты, fixtures, конфиги, lockfile и версию плана. После сборки связать snapshot с dist/tarball hash.
5. **Green.** Прогнать regression, обязательный полный Mars набор, differential baseline и gates среза на этом snapshot. После команд проверить неизменность исходников. Любая новая правка требует новых результатов для затронутых gates; данные от старого `dist` не принимаются.
6. **Challenge.** Для критического ISO проверить чувствительность теста на отдельной ограниченной временной копии: вернуть именно дефект, пересобрать и получить конкретный FAIL. Не ломать общую рабочую копию; не считать синтаксическую ошибку успешным negative control. Удалять только проверенные task-scoped временные пути.
7. **Review.** Reviewer получает требования/ISO, baseline, code diff и сырые логи, но не готовый PASS исполнителя. Он проверяет смысл assertions и сам повторяет ключевой сценарий/negative control. Замечание содержит файл, нарушение, воспроизводитель и критерий закрытия.
8. **Decide.** Любое обоснованное нарушение возвращает цикл к Fix; после исправления — новый snapshot и новое ревью. `accepted` требует всех gates среза и отсутствия открытых замечаний по нему. ISO будущих срезов остаются открытыми; приёмка части не равна приёмке всей изоляции.
9. **Checkpoint.** Обновить журнал и при наличии разрешения сохранить локальный commit только своих файлов. Сверить итоговое source tree с проверенным snapshot, включая изменения hooks. Продолжать следующий разрешённый срез без просьбы «продолжи», пока есть бюджет, права и принятые зависимости.

### Обязательные negative controls

| Исправление | Что намеренно нарушить во временной копии | Что обязано упасть |
| --- | --- | --- |
| Definitions | Снова отбросить `statusOnHit`/`healTargetTags` | Семантический тест burn/heal, не только parse/determinism |
| Rules | Вернуть draw для attacker timeout / потерять tick | Проверка точного winner/tick и отсутствия преждевременного эффекта |
| Validation | Вернуть пустой список вместо ошибки unknown definition | Предсимуляционная проверка некорректного входа |
| Placement | Вернуть полосу 320 | Случайное размещение на 100×100 с фиксированным воспроизводящим seed |
| DTO | Скопировать служебное поле в публичный snapshot | Проверка отсутствия поля и совместимости wire |
| Ownership | В проверяемом spawn-пути заменить battle catalog общим; вернуть эвристику имени | Межигровой late-spawn/trait-тест и guard на глобальную зависимость |
| Exports | Временно открыть существующий private subpath | Проверка `ERR_PACKAGE_PATH_NOT_EXPORTED` |
| Consumer matrix | Отключить фактический effect/spawn в runtime | Соответствующий сценарий завершается ненулевым exit code |

Не нужен большой mutation-testing framework: достаточно воспроизводимого целевого контроля для каждого класса исправлений. Его diff и результаты сохраняются как evidence, но mutation не переносится в итоговые исходники.

## 5. Команды и доказательства

Существующие команды, которые сохраняются; на Windows допустимы `npm.cmd`/`npx.cmd`:

```text
npm run combat:core:build
npm run combat:core:check
npm test
npx tsc --noEmit --pretty false
npx tsx scripts/check-limits.ts --diff HEAD --json
npx tsx scripts/check-limits.ts --json
npm run test:combat:package
npm run lint
npm run build
npm run test:e2e:replay
```

Первые build/check и полный test/typecheck/limits обязательны после каждого изменяющего combat среза. Full scan не заменять пустым `--diff HEAD` после коммита. Для проверки diff у принятого commit использовать известную базу среза; требуемую AGENTS команду также сохранить. Guards и tests нельзя ослаблять.

Новые команды ещё предстоит реализовать: `typecheck`, `test:combat:core`, `test:combat:compat`, `test:combat:package:runtime`, `test:combat:package:boundary`, `test:combat:certify`. Названия можно уточнить один раз в R1; manifest и CI должны содержать реальные команды, а не обещания. Runtime smoke вводится R1, расширяется по R2–R5; boundary gate закрывается R6, полная certification — R7. Исторический package smoke до усиления не подтверждает эти новые gates.

Каждый изменяющий пакет срез повторяет архивный runtime smoke и соответствующие новые fixtures. После R4–R6 обязательны также Next production build, replay compatibility/smoke и dependency audit. Финальная clean/multiplatform проверка не заменяется прогоном в тёплом workspace. PR10–PR15 запускать по inventory R0, не предполагать, что все CLI входят в `npm test`.

Минимальная запись evidence в `docs/combat-core-isolation-progress.md`:

- Run ID, UTC, фактические модель/клиент/инструменты; OS/Node/npm/browser и доступный бюджет, источник полномочий.
- R-срез, ISO, статус, попытка, writer, принятые зависимости и точный следующий шаг.
- Полные source/test/plan hashes; baseline SHA; frozen snapshot до/после; tarball SHA256 и установленные версии зависимостей.
- Для RED/GREEN/CHALLENGE: команда, cwd, окружение, exit code, ожидаемый и фактический результат, путь к полному логу без секретов.
- Reviewer/session, проверенный snapshot, замечания и вердикт. ID reviewer-сессии не выдавать за Git SHA.
- Открытые ISO, непроверенные gates, активные процессы/session/PID, основания повторного запуска. Старый FAIL не затирать повторным PASS; фиксировать оба и причину различия.

Логи хранить в выделенном task-scoped artifact каталоге или CI artifacts; большие файлы/архивы не коммитить автоматически. Журнал может обновляться после проверки, если tested source/test/config tree неизменно и его hash сохранён. Изменение требований, исходников, fixtures или тестов инвалидирует соответствующую приёмку; новый commit должен быть явно связан с проверенным tree.

## 6. Остановки, возобновление и Definition of Done

- Для unattended-запуска нужен заданный владельцем/средой наблюдаемый лимит; этот план не назначает 24 часа и не обещает уложиться в них. Пока лимит не согласован, допустим безопасный аудит, не бесконечная реализация.
- Три последовательные попытки одного среза без устранённого дефекта, сужения причины или нового проверенного gate — повод остановить зависимую работу и запросить решение. Смена seed или повтор той же команды сами по себе не считаются прогрессом.
- При красном Mars baseline искать первое отличие input/compiler/tick/phase. Не менять goldens, PRNG, порядок ID/events, tolerance, revisions, CI или assertions для получения PASS.
- Отсутствующее окружение/reviewer отмечать `BLOCKED`/`needs_external_review`; при бюджете — `stopped_budget`. Продолжать можно только независимые разрешённые задачи, не принимать зависимый этап заочно.
- После compaction/новой сессии прочитать журнал, сверить HEAD/diff/source hashes и живые процессы; не запускать второй writer/test build поверх уже идущего. Устаревшие результаты явно переоткрыть.
- При необходимости отката сохранить пользовательские изменения и использовать только согласованное восстановление конкретного task checkpoint. Не применять force push, reset/массовую очистку, не удалять основные каталоги/worktree.

Готовность требует одновременно:

- [ ] ISO-01–13 закрыты воспроизводимыми тестами и независимым ревью.
- [ ] Все принимаемые данные публичного API либо корректно исполняются, либо явно отклоняются до боя; обязательные механики работают.
- [ ] Один runtime; нет Mars content/name heuristics, глобальных registries и fallback-каталогов; все пути создания используют per-battle context.
- [ ] Production exports/`.d.ts` закрывают ECS; тестовый доступ не публикуется и не используется приложением.
- [ ] Рабочий DTO/codec путь сохраняет legacy Mars JSON, persistence, replay и исторические golden/diagnostic результаты.
- [ ] Разделены contract/engine/ruleset/replay identities; metadata не скрывают поведенческие различия.
- [ ] Свежая сборка, реальный архивный потребитель и Node 22 Windows/Linux + Chromium matrix прошли на соответствующем финальному коду артефакте.
- [ ] Все обязательные CI/architecture/performance/replay gates выполнены; нет замаскированных FAIL/NOT_RUN и необъяснённых регрессий.
- [ ] Итоговый snapshot совпадает с проверенным; журнал, README/ADR/AGENTS и launch-команды отражают фактическую архитектуру.

Число коммитов, успешных reviewer-ответов, часов и циклов не входит в критерии готовности.

## 7. Короткий промпт для отдельного запуска реализации

Ниже шаблон будущего задания, а не объявление, что реализация разрешена или уже началась. Перед передачей явно задать бюджет и права на локальные checkpoints/внешние действия.

```text
Исправь проблемы изоляции уже выделенного combat-core по
docs/combat-core-isolation-remediation-plan.md. Прочитай AGENTS.md и связанные
документы полностью. Начни с R0 поверх фактической extraction-ветки; не запускай
перенос E0–E7 заново от master и не используй terrain-ветку как базу.

На каждый срез: критерий → воспроизводящий RED → минимальный FIX → frozen
snapshot → GREEN полного обязательного набора → целевой negative control →
отдельное read-only REVIEW → исправления/повтор → checkpoint → следующий срез.

Проверяй фактические burn/heal/spawn/ticks/winner, а не только одинаковость
результатов. Не меняй Mars goldens, semantics, guards и assertions ради PASS.
Не используй старый dist или чужой отчёт как evidence нового snapshot.

Веди docs/combat-core-isolation-progress.md. Непроверенное отмечай NOT_RUN;
без настоящего независимого reviewer — needs_external_review. Подтверди
доступный бюджет и права до unattended-реализации; не придумывай лимиты.
Без отдельного разрешения не push/PR/merge/deploy/publish и не меняй production.

Продолжай разрешённые срезы без просьб «продолжи» до полной Definition of Done,
документированного блокера либо исчерпания бюджета. Не объявляй completed,
пока остаётся хотя бы один обязательный непроверенный gate или открытый ISO.
```
