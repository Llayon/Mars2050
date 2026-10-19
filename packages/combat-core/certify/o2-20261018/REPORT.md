# O2 — первый измеримый оптимизационный срез `@mars2050/combat-core`

Дата: 2026-10-19. Ветка: `perf/combat-core-o2-v1`. Worktree: `D:\Max\Mars2050-o2`.
База: `1134ffa9b80b3d66aee447e557e3bb20507b9269` (ветка `repair/combat-core-isolation`).

| Сущность | Значение |
| --- | --- |
| Пакет-кандидат | `@mars2050/combat-core@0.1.0-o2mv.1` |
| Tarball (вне git) | `D:\Max\o2\evidence\mars2050-combat-core-0.1.0-o2mv.1.tgz` |
| SHA256 архива | `4e4a0f36754a5a6918970e9ca06f5729fdc52ce48f3a3b90e70c46130be6b6c7` |
| Байт | 418811 |
| `dist` файлов | 912 (пофайловый пин: `manifest.json` этого бандла) |
| База сравнения (оракул) | `@mars2050/combat-core@0.1.0-o1mv.1`, SHA256 `421ad6e35821aeafa0f1bbd3a93cfd69a3fbb81523d031ab6eaa0f8bb13a67f3` |

Оракул корректности — принятый `o1mv.1` (R7 + O1 + CORE-HANDOFF movement fix), а не старый R7 с
неполным журналом перемещений. Golden-хеши ради O2 не обновлялись.

## 1. Свежая диагностика (до оптимизации)

Методика: `scripts/o2-verify/profile.ts` запускает V8 через `inspector` и включает сэмплирование
**только на измеряемой области симуляции** — загрузка модулей, построение zod-схем и прогрев в
профиль не попадают. CPU: `Profiler.start` (интервал 100 мкс). Память:
`HeapProfiler.startSampling` (интервал 4096 Б, `includeObjectsCollectedBy*GC: true`, то есть
учитывается и собранный мусор). Контур A (публичный `simulateCombat`) на канонических входах
`zerg_rush` (68 отрядов → 605 юнитов, 184 тика) и `massive_clash` (73 тика).

Горячие места по временным аллокациям (2 боя `zerg_rush`, всего ≈5.65 ГБ сэмплированных
аллокаций), baseline `o1mv.1`:

| Ранг | Сайт | Байт | Доля |
| --- | --- | ---: | ---: |
| 1 | `EcsActionGroupLedger.begin` (`combat.action-intent.ts`) | 1 263 024 120 | 22.4 % |
| 2 | `zod` `inst._zod.parse` (валидация результата, обязательна контрактом) | 541 046 624 | 9.6 % |
| 3 | `buildAllPairs` (`movement-collision-pairs.ts`) — массив-пара на каждую пару | 447 137 568 | 7.9 % |
| 4 | `Map#set` (в основном карты фрейма защиты) | 363 469 112 | 6.4 % |
| 5 | `Math.hypot` (математика — не трогаем) | 208 673 560 | 3.7 % |
| 6 | `getEcsSteeringContext` — объекты `{x, y}` на соседа | 191 498 704 | 3.4 % |

CPU self-time (тот же бой, 3 прогона):

| Функция | Доля self-time |
| --- | ---: |
| `structuredClone` (`node:internal/worker/js_transferable` + JS-обёртка) | 14.7 % |
| `begin` (`combat.action-intent.ts`) | 6.2 % |
| `get` / `getSizeRadius` / `require` / `getDistance` (доступ к стораджам и таблицам размеров) | ≈14 % |
| `zod` parse | 2.5 % |
| GC | 1.8 % |

Прямой счётчик вызовов (`scripts/o2-verify/count-clones.ts`) подтвердил гипотезу количественно:

| Сценарий | вызовов `structuredClone` за бой | из них клон пустого массива | время в `structuredClone` |
| --- | ---: | ---: | ---: |
| `zerg_rush` | 516 097 | 499 449 (96.8 %) | 2009 мс |
| `massive_clash` | 27 969 | 26 345 (94.2 %) | 127 мс |

**Что профиль не подтвердил.** Исходный план предполагал в качестве первого участка
«создание временных массивов spatial-кандидатов» и «временные объекты векторов и дистанций» в
выборке целей. Фактически выборка кандидатов уже работала на типизированных буферах
(`TargetingScratch` — `Int32Array`/`Float64Array` с переиспользованием, `TargetingPackedCells` —
плоские массивы с `offsets`): её вклад в топ аллокаторов не попал, и трогать её не потребовалось.
Точная тригонометрия (`deterministicAtan2`/`deterministicAtan`, ≈3.6 % CPU) и `Math.hypot`
намеренно не изменялись — это математика.

## 2. Что оптимизировано

Ровно два подтверждённых участка, оба — устранение ненужных временных объектов; ни один не
вводит общий изменяемый singleton, ни один не удерживает ссылку дольше одного вызова/одного
тика, ни один не меняет порядок обхода или математику.

### S1. `EcsActionGroupLedger.begin`: снимок защитного фрейма больше не клонирует пустые списки

`packages/combat-core/src/combat.action-intent.ts`. Снимок `TargetDefenseSnapshot` для каждого
живого юнита теперь получает статусы через локальный помощник:

```ts
function cloneStatusEffects(source: RuntimeStatusEffect[]): RuntimeStatusEffect[] {
  return source.length === 0 ? [] : structuredClone(source)
}
```

Это не «шaring» и не кэш: при пустом списке (подавляющее большинство снимков) возвращается
новый пустой массив вместо полного прохода сериализатора, который для `[]` даёт ровно такой же
результат. Непустой список по-прежнему проходит `structuredClone`, поэтому живой стор
`statusControl` никогда не оказывается в фрейме по ссылке. Публичный контракт
`TargetDefenseSnapshot.statusEffects` (`readonly RuntimeStatusEffect[]`) не изменён, поля не
усечены, `structuredClone(targetMark)` для метки сохранён.

### S2. `getEcsSteeringContext`: направление расталкивания без объекта на соседа

`packages/combat-core/src/ecs/movement-steering.ts`. Приватный `getAwayVector(...): {x, y}`
создавал объект на каждого соседа в радиусе расталкивания (до 32 на юнита за тик). Теперь
функция возвращает только угол (`getAwayAngle(...): number`), а компоненты направления считаются
в вызывающем коде локальными переменными. Арифметика ветвей (`dist > 0` — нормализация `dx/dy`
по `getDistance`; `dist === 0` — детерминированный хеш пары внешних id, `Math.PI * 2`,
зеркальный сдвиг `+ Math.PI`) побитово та же, порядок обхода соседей не изменён.

`git diff` кандидата относительно базы `1134ffa`:

```
packages/combat-core/src/combat.action-intent.ts     | 10 +++++--
packages/combat-core/src/ecs/movement-steering.ts    | 37 +++++++++++++--------
```

Итог профиля кандидата (те же условия измерений): `structuredClone` 14.7 % → **2.0 %**
self-time, сайт `begin` 1263 МБ → **716 МБ** временных байт, вызовов `structuredClone` в бою
`zerg_rush` 516 097 → **16 648**.

## 3. Производительность: A/B

Методика (`scripts/o2-verify/run-ab.mjs`, `run-ab-fantasy.mjs`): на каждую точку по 5 итераций,
в каждой итерации по одному процессу на вариант с чередованием порядка
baseline→candidate / candidate→baseline; внутри процесса прогрев и затем 5 измеренных прогонов;
пауза 2500 мс между процессами; порядок и медианы считаются по медианам процессов плюс
по-парные отношения. Вариант выбирается junction-переключением `node_modules/@mars2050/combat-core`
на распакованный baseline-архив либо на пакет кандидата; драйвер падает, если реальный
разрешённый путь модуля не совпал с ожидаемым деревом (гвард происхождения), и каждый сырой
отчёт содержит разрешённый путь + SHA256 входного модуля. Хеши результата сверяются во всех
измеренных прогонах, `hashesEqual` = побитовое совпадение.

### 3.1 Pure Core (контур A) — публичный `simulateCombat` установленного пакета

| Точка | baseline, медиана процессов | candidate, медиана | отношение медиан | медиана по-парных отношений | по-парные отношения | разброс всех прогонов (min–max), мс |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `massive_clash` (5 пар) | 527.5 мс | 450.9 мс | **1.170×** | 1.192× | 1.231, 1.168, 1.225, 0.989, 1.192 (4/5 > 1) | B 369.8–767.2 · C 328.0–590.2 |
| `zerg_rush` (9 пар, расширенный прогон) | 3970.0 мс | 3176.0 мс | **1.250×** | 1.251× | 1.430, 1.275, 1.245, 1.129, 1.206, 1.347, 1.136, 1.316, 1.251 (**9/9 > 1**) | B 3575–5165 · C 2891–3898 |

### 3.1.1 Расширенное измерение `zerg_rush` (Pure Core)

Первые 5 пар `zerg_rush` этого контура дали очень широкий разброс (медианы baseline
4535–6716 мс, 3/5 отношений в пользу кандидата), поэтому точка была **переизмерена отдельно с 9
парами** (те же настройки: прогрев 2, 5 прогонов, чередование порядка, пауза). Расширенный
прогон дал устойчивый и односторонний результат: 9/9 парных отношений в пользу кандидата,
1.250× по медиане медиан, при этом разброс кандидата существенно у́же (2891–3898 мс против
3575–5165 мс у baseline). 5-парный результат `zerg_rush` (`1.258×`, но 3/5) сохранён как
исходный и не используется как доказательство.

Отдельный подтверждающий прогон на **установленном архиве-кандидате** (consumer
`D:\Max\o2\consumer`, тот же tarball `4e4a0f36…b6c7`) приведён в
`measurements/ab-installed/` — он доказывает, что измеренный код происходит именно из
распакованного архива, а не из произвольного workspace `dist` (см. также раздел 7).

### 3.2 Mars Compat (контур B) — `simulateBattle` через адаптер Mars

| Точка | baseline, медиана процессов | candidate, медиана | отношение медиан | медиана по-парных отношений | по-парные отношения | разброс всех прогонов (min–max), мс |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `massive_clash` | 479.9 мс | 425.8 мс | **1.127×** | 1.083× | 1.161, 1.074, 1.052, 1.083, 1.224 (5/5 > 1) | B 385.9–591.4 · C 351.2–588.4 |
| `zerg_rush` | 5830.4 мс | 4754.4 мс | **1.226×** | 1.226× | 1.259, 1.170, 1.182, 1.345, 1.226 (5/5 > 1) | B 5250.4–8551.9 · C 4566.9–5529.8 |

В контуре B хуже масштабируется разброс, но **все 5 из 5 парных отношений** в обеих точках
указывают в одну сторону, а сквозное время включает неизменённые трансляцию входа, валидацию и
маппинг результата (то есть измеренное ускорение ядра «разбавлено» постоянной частью адаптера —
это ожидаемое поведение, а не признак регрессии).

### 3.3 Fantasy (контур C) — нативный путь Fantasy на реальном корпусе

Node v26.11.1 (портативный тулчейн стенда Fantasy), четыре репрезентативных сценария из 159,
**9 пар** каждая (чередование порядка, прогрев 2, 5 измеренных прогонов на процесс; первичный
5-парный прогон сохранён в `measurements/fantasy/ab/`):

| Сценарий | baseline | candidate | отношение медиан | медиана по-парных | пар в пользу кандидата |
| --- | ---: | ---: | ---: | ---: | ---: |
| `recruit/orc-black-fang/attacker` | 62.7 мс | 56.2 мс | 1.115× | 1.148× | 9/9 |
| `recruit/dawn-oathkeeper/defender` | 149.0 мс | 113.9 мс | **1.308×** | 1.282× | 9/9 |
| `recruit/dawn-shield-marshal/attacker` | 141.7 мс | 124.5 мс | 1.139× | 1.129× | 6/9 |
| `recruit/court-coffin-bearer/defender` | 142.7 мс | 112.7 мс | **1.266×** | 1.281× | 9/9 |

Единственная точка с неполным перевесом (`dawn-shield-marshal`, 6/9) содержит три пары с
отношением 0.31–0.42 — очевидные выбросы среды (в этих же процессах видны и абсолютные
минимумы кандидата 109 мс); медиана медиан всё равно 1.139×, но эта точка не подаётся как
доказанная, а как «в целом в пользу кандидата, разброс среды велик».

### 3.4 Что дал каждый участок

* **S1 подтверждён количественно и детерминированно**: `structuredClone` в бою `zerg_rush`
  516 097 → 16 648 вызовов (−96.8 %), измеренное время внутри `structuredClone` 2009 мс →
  352 мс, self-time CPU 14.7 % → 2.0 %, временные байты сайта `begin` 1263 МБ → 716 МБ.
* **S2 подтверждён детерминированным счётчиком, но не отделён в сэмплирующем профиле**: временная
  инъекция счётчика в собранный `dist` (счётчик снят, `dist` затем побайтово сверен с манифестом)
  показала **1 330 719** исполнений ветки расталкивания на один бой `zerg_rush`, то есть ровно
  столько объектов `{x, y}` S2 больше не создаёт. При этом байты, приписанные сэмплером кадру
  `getEcsSteeringContext`, между baseline и кандидатом не разделились (191 МБ против 193 МБ, в
  пределах шума 4096-байтовой выборки), поэтому **отдельный вклад S2 во время не заявляется**:
  измеренное ускорение относится к срезу S1+S2 в целом, а профильный аргумент в пользу S2 —
  только устранение аллокаций.
* Ни один участок не подтверждён как «ускорение за счёт GC»: отдельного измерения GC-времени
  с достаточной статистикой не проводилось (`(garbage collector)` self-time 1.8 % → 2.5 %,
  это уровень шума), поэтому причинная атрибуция к GC в отчёте не делается.

Хеши результатов совпадают между вариантами во всех измеренных прогонах всех трёх контуров
(`hashesEqual=true`, `invariant=true` для каждого варианта в отдельности).

Измерялась целевая фаза (сам тик-цикл) и сквозное время; CPU-профилирование выполнялось
отдельно от замеров времени (раздел 1), self-time профиля не выдаётся за долю сквозного
ускорения.

## 4. Память

Отдельный контур A, 3 процесса на вариант, по 5 боёв в процессе, `--expose-gc`, между боями не
форсируется. Пиковое потребление и удерживаемая после явного полного GC память:

| Сценарий | Метрика | baseline (3 процесса) | candidate (3 процесса) |
| --- | --- | --- | --- |
| `zerg_rush` | peak heapUsed | 377.5 / 328.1 / 344.7 МБ | 464.4 / 347.0 / 356.4 МБ |
| `zerg_rush` | peak RSS | 555.7 / 560.7 / 560.6 МБ | 648.3 / 560.3 / 560.6 МБ |
| `zerg_rush` | retained heapUsed после GC | 56.66 / 56.68 / 56.68 МБ | 57.54 / 57.53 / 56.64 МБ |
| `massive_clash` | peak heapUsed | 86.3 / 96.2 / 131.8 МБ | 107.6 / 99.8 / 86.2 МБ |
| `massive_clash` | retained heapUsed после GC | 23.92 / 24.00 / 24.06 МБ | 23.98 / 24.04 / 23.98 МБ |

**Вывод честный: эффекта по памяти не подтверждено.** Пиковое heap/RSS колеблется между
процессами сильнее, чем разница между вариантами (у кандидата в первом процессе каждой точки
виден более высокий пик — артефакт старта процесса, а не следствие среза); удерживаемая после
полного GC память в обеих точках совпадает в пределах ±1.5 %. Детерминированный аргумент по
аллокациям — только профильный: 5 650 704 952 → 5 067 133 448 сэмплированных байт на 2 боя
`zerg_rush` (−10.3 %). Утверждать снижение RSS/retained-памяти по этим данным нельзя.

## 5. Корректность

| Проверка | Результат |
| --- | --- |
| Ядро: unit-набор (`npm run test:combat:core`) | 40 файлов / 306 тестов — PASS (на базе 38/293 плюс два новых файла O2) |
| Mars: полный unit-набор (`npm test`) | 207 файлов / 875 тестов — PASS |
| Golden V8 (`npm run combat:ecs:golden`) | 7 пресетов, эталоны не менялись — PASS |
| Golden V9 (`npm run combat:ecs:v9:golden`) | 7 пресетов, эталоны не менялись — PASS |
| Установленный архив кандидата (`verify-archive.mjs --tarball … --expect-sha …`) | 912/912 файлов манифеста, R7-матрица 5/5, оба MRE 0 несогласованных кадров, `ARCHIVE-VERIFY=PASS` |
| Сверка текущего `dist` с манифестом (`compare-dist.mjs`) | 912/912, `contentIdentical=true` (после всех экспериментов и восстановления) |
| Fantasy, 159 сценариев нативного пути | 159/159 идентичных SHA результатов относительно `o1mv.1` |
| Архитектурные лимиты (`check-limits.ts`) | PASS (0 нарушений) |
| `npx tsc -p tsconfig.test.json --noEmit` | PASS |
| `npx tsc --noEmit` (корень) | 6 ошибок, все — предсуществующие в `packages/combat-core/tests/movement-journal-completeness.test.ts` (файл CORE-HANDOFF, не изменялся); на базе `1134ffa` ровно те же 6 ошибок (проверено `git stash` + повторный прогон) |
| `combat:core:check` (typecheck ядра) | PASS |
| `npm run lint` | 0 ошибок, 146 warning (все предсуществующие; новых от `scripts/o2-verify` нет) |
| `npm run test:combat:package` | PASS, включая блокировку неэкспортированных внутренних подпутей |
| `npm run test:combat:package:runtime` | PASS (`Runtime archive smoke`) |
| `npm run test:combat:scenarios` | 10 тестов — PASS |
| production `npm run build` | PASS |
| `npm run replay:visuals` | 49/50 прямых ассетов + 1 исключение — PASS |
| replay smoke `npm run test:e2e:replay` (Chromium) | 9 тестов — PASS |

### Регрессионные тесты O2

`packages/combat-core/tests/o2-buffer-isolation.test.ts` (13 тестов, входят в `test:combat:core`):

* одинаковый вход и seed → одинаковый результат;
* первый бой не меняется после серии последующих боёв (в обе стороны);
* последовательность маленький → большой → маленький;
* отклонённый запуск (неизвестное определение, `seed: NaN`) не загрязняет следующий;
* два каталога с совпадающими id не влияют друг на друга;
* глубокая заморозка входа: `simulateCombat` не мутирует вход и даёт тот же результат;
* результат — чистые данные: JSON-снимок не меняется после следующих боёв, элементы массивов не
  разделяют ссылки;
* снимок защитного фрейма: пустой список статусов — свежий массив, не алиасится живому стору,
  мутация живого стора не видна снимку, два последовательных фрейма не делят один массив;
* непустой список статусов копируется (не по ссылке), мутация живого элемента не видна снимку;
* пустой spatial-запрос → длина 0 и отсутствие «хвоста» предыдущего запроса;
* насыщенный spatial-запрос → детерминированный порядок кандидатов, совпадающий между повторами;
* после ручных probe-выборок мир продолжает симулироваться с тем же результатом.

### Отрицательные контроли (`scripts/o2-verify/run-negative-controls.mjs`)

Три мутации применяются изолированно, каждая должна уронить набор, после каждой файл
восстанавливается и сверяется побайтово (`restoredByteIdentical`), в кандидате мутаций нет:

| Мутация | Ожидаемый отказ | Факт |
| --- | --- | --- |
| общий модульный пустой массив вместо свежего | `never aliases the live status list` | 1 тест упал |
| возврат живого массива статусов без копии | оба теста изоляции фрейма | 2 теста упали |
| снятый `scratch.reset()` в `TargetingRuntime.collect` | «пустой запрос» и «порядок кандидатов» | 2 теста упали |

Итог: `allControlsPassed=true`, после восстановления набор снова зелёный.

## 6. Кросс-среда

Установленный архив кандидата (не workspace `dist`); прогон R7-матрицы из 5 сценариев:

| Среда | Версия | R7-матрица | Установленный архив |
| --- | --- | --- | --- |
| Windows | Node v22.20.0 | 5/5 PASS | consumer из tarball `4e4a0f36…b6c7` |
| Windows | Node v25.6.0 | 5/5 PASS | consumer из tarball `4e4a0f36…b6c7` |
| Windows | Node v26.11.1 | 5/5 PASS | consumer из tarball `4e4a0f36…b6c7` |
| Windows Chromium | Google Chrome 155.0.8059.80 | 5/5 PASS | бандл с 0 входами из workspace |
| Linux (GitHub Actions) | Node v22.23.3 | 5/5 PASS | `installed-vs-manifest` 912/912, оба MRE 0 несогласованных кадров, `ARCHIVE-VERIFY=PASS` |
| Linux (GitHub Actions) | Node v26.12.0 | 5/5 PASS | `installed-vs-manifest` 912/912, оба MRE 0 несогласованных кадров, `ARCHIVE-VERIFY=PASS` |

CI: workflow `core archive verify (Linux)`, run [39221737787](https://github.com/Llayon/Mars2050/actions/runs/39221737787)
для коммита `dfbd9d719ee928d186c9d0dac4c651619e9b731b` — job'ы `Node 22 o2 archive verification`
и `Node 26 o2 archive verification` завершились успешно (в обоих: ядро 306/306 тестов, 912/912
файлов манифеста, матрица 5/5, оба MRE без расхождений); job `o1 archive verification` корректно
не запускался на этой ветке (её источник уже не воспроизводит манифест `o1mv.1`).
Linux `npm pack` даёт другие байты архива (`f8a504ef4aaf6ce4…`), чем Windows-релиз — как и в
CORE-HANDOFF, сравнивается именно содержимое (пофайловый манифест), а не байты tar.

Хеш входного модуля установленного кандидата во всех средах совпадает:
`502b750f8baba5fc05246ae696bd6580bf10659d41566309091b280048a54579`
(`dist/index.js` пакета `0.1.0-o2mv.1`).

## 7. Provenance и артефакты

* **Происхождение Pure Core.** Baseline ставился из принятого tarball `421ad6e3…67f3`
  (`D:\Max\o2\baseline-install`, версия `0.1.0-o1mv.1`; байты также сверены с копией в
  `D:\Max\fantasy-battles\apps\fantasy\vendor\core\mars2050-combat-core-0.1.0-o1mv.1.tgz`).
  Кандидат ставился из собственного tarball `4e4a0f36…b6c7` в отдельный consumer
  (`D:\Max\o2\consumer`, версия `0.1.0-o2mv.1`, zod 4.4.2). Каждый сырой отчёт A/B содержит
  разрешённый путь модуля и его SHA256, а драйвер падает, если путь не совпал с ожидаемым
  деревом (гвард происхождения); подтверждающий прогон `measurements/ab-installed/` показывает
  `D:/Max/o2/consumer/node_modules/@mars2050/combat-core/dist/index.js | 0.1.0-o2mv.1`.
  Дополнительно: текущий workspace `dist` побайтово равен пофайловому манифесту
  (`compare-dist.mjs`, 912/912, `contentIdentical=true`), а манифест, в свою очередь, сверен
  с содержимым установленного архива в `verify-archive.mjs` (912/912). Тем самым измеренный
  код кандидата — это ровно содержимое выпущенного архива.
* **Что именно изменено в артефакте.** Сравнение `manifest.json` кандидата с манифестом
  `o1mv.1`: **912 файлов, 0 добавлено, 0 удалено, изменено 6** —
  `dist/combat.action-intent.js` (+`.js.map`, `.d.ts.map`) и
  `dist/ecs/movement-steering.js` (+`.js.map`, `.d.ts.map`). `dist/index.js` и все схемы/`.d.ts`
  побайтово те же, то есть публичная поверхность экспортов и типов не изменилась
  (`measurements/dist-delta-o2-vs-o1mv1.json`).
* **Точный diff оптимизации**: `measurements/o2-source-diff.patch`
  (SHA256 `0243817ce4fb4f91…`), 2 файла `packages/combat-core/src/**`.
* **Пин содержимого**: `manifest.json` этого бандла (SHA256 `705800237b7cfa62…`), 912 пофайловых
  SHA256 + SHA256 архива; в `measurements/index.json` — SHA256 каждого файла замеров.
* **Сырые V8-профили** (десятки МБ) остаются в лаборатории `D:\Max\o2\profiles`; в бандл попали
  сводки (`profile-baseline-A-zerg-heap.json` и т.д.) плюс SHA256 и размер исходных профилей.
* **Опровергнутая гипотеза профиля**: S2 подтверждён счётчиком (1 330 719 устранённых объектов
  `{x,y}` на бой `zerg_rush`), но приписанные сэмплером байты кадра `getEcsSteeringContext`
  между вариантами не разделились (191 МБ → 193 МБ, шум). Это зафиксировано, а не замазано.

## 8. Команды и exit codes

Все команды выполнялись из `D:\Max\Mars2050-o2`, если не указано иное; версия Node — v25.6.0,
кроме отдельно указанных (baseline/candidate-потребители — то же), Fantasy-контур — портативный
`D:\Max\fantasy-battles\.tools\node26\node.exe` (v26.11.1).

```sh
# база и рабочее дерево
git worktree add -b perf/combat-core-o2-v1 D:\Max\Mars2050-o2 1134ffa9b80b3d66aee447e557e3bb20507b9269
npm install --prefer-offline --no-audit --no-fund                  # exit 0

# baseline-потребитель принятого архива (D:/Max/o2/baseline-install)
node scripts/o2-verify/cross-env/install-consumer.mjs --tarball D:/Max/o2/baseline-o1mv.1.tgz --dir D:/Max/o2/baseline-install

# канонические входы контуров A/B
npx tsx scripts/o2-verify/freeze-inputs.ts                         # exit 0

# кандидат: сборка, архив, пофайловый манифест
npm run combat:core:build                                          # exit 0
node scripts/o2-verify/pack-candidate.mjs --version 0.1.0-o2mv.1 --lab D:/Max/o2   # exit 0

# проверка УСТАНОВЛЕННОГО архива кандидата (R7-матрица + оба MRE)
node packages/combat-core/certify/o2-20261018/verify-archive.mjs \
  --tarball D:/Max/o2/evidence/mars2050-combat-core-0.1.0-o2mv.1.tgz \
  --expect-sha 4e4a0f36754a5a6918970e9ca06f5729fdc52ce48f3a3b90e70c46130be6b6c7    # exit 0

# диагностика аллокаций
npx tsx scripts/o2-verify/count-clones.ts --preset zerg_rush        # exit 0
npx tsx scripts/o2-verify/profile.ts --contour A --mode heap --preset zerg_rush --warmup 1 --runs 2 --out D:/Max/o2/profiles/x.heapprofile
npx tsx scripts/o2-verify/profile.ts --contour A --mode cpu  --preset zerg_rush --warmup 1 --runs 3 --out D:/Max/o2/profiles/x.cpuprofile
node scripts/o2-verify/summarize-profile.mjs <profile> --top 25     # exit 0

# A/B времени и памяти
node scripts/o2-verify/run-ab.mjs --contours A,B --presets massive_clash,zerg_rush --iterations 5 --runs 5 --warmup 2 --out D:/Max/o2/evidence/ab
node scripts/o2-verify/run-ab.mjs --contours A --presets zerg_rush --iterations 9 --runs 5 --warmup 2 --out D:/Max/o2/evidence/ab-zerg-extended
node scripts/o2-verify/run-ab.mjs --contours A --presets massive_clash --iterations 3 --runs 5 --warmup 2 --candidate D:/Max/o2/consumer/node_modules/@mars2050/combat-core --out D:/Max/o2/evidence/ab-installed
node scripts/o2-verify/run-ab-memory.mjs --presets zerg_rush,massive_clash --iterations 3 --battles 5 --out D:/Max/o2/evidence/memory   # exit 0

# Fantasy-контур
node scripts/o2-verify/build-fantasy-bundles.mjs                    # exit 0
D:\Max\fantasy-battles\.tools\node26\node.exe scripts/o2-verify/measure-fantasy.mjs --bundle D:/Max/o2/fantasy/baseline/native-compare.mjs --mode hash --out D:/Max/o2/evidence/fantasy/baseline-hash.json
D:\Max\fantasy-battles\.tools\node26\node.exe scripts/o2-verify/measure-fantasy.mjs --bundle D:/Max/o2/fantasy/candidate/native-compare.mjs --mode hash --out D:/Max/o2/evidence/fantasy/candidate-hash.json
node scripts/o2-verify/run-ab-fantasy.mjs --scenarios "..." --iterations 9 --runs 5 --warmup 2 --out D:/Max/o2/evidence/fantasy/ab9  # exit 0

# кросс-среда (установленный архив в consumer)
node scripts/o2-verify/cross-env/install-consumer.mjs --tarball D:/Max/o2/evidence/mars2050-combat-core-0.1.0-o2mv.1.tgz --dir D:/Max/o2/consumer
<node22|node25|node26> scripts/o2-verify/cross-env/run-scenarios.mjs D:/Max/o2/consumer packages/combat-core/certify/o2-20261018/matrix-fixtures.mjs <report>.json
node scripts/o2-verify/cross-env/check-matrix.mjs <report>.json packages/combat-core/certify/o2-20261018/r7-matrix.json
node scripts/o2-verify/cross-env/browser-runner.mjs D:/Max/o2/consumer D:/Max/o2/evidence/cross-env/browser-report.json

# гейты
npm run test:combat:core            # exit 0  (40 файлов / 306 тестов)
npm test                            # exit 0  (207 файлов / 875 тестов)
npm run combat:ecs:golden           # exit 0
npm run combat:ecs:v9:golden        # exit 0
npm run combat:core:check           # exit 0
npx tsc -p tsconfig.test.json --noEmit   # exit 0
npx tsc --noEmit                    # exit 1  — 6 предсуществующих ошибок на базе (см. раздел 5)
npx tsx scripts/check-limits.ts     # exit 0
npm run lint                        # exit 0  (0 ошибок, 146 предсуществующих warning)
npm run test:combat:package         # exit 0
npm run test:combat:package:runtime # exit 0
npm run test:combat:scenarios       # exit 0
npm run build                       # exit 0
npm run replay:visuals              # exit 0
npm run test:e2e:replay             # exit 0

# отрицательные контроли и сбор доказательств
node scripts/o2-verify/run-negative-controls.mjs --out D:/Max/o2/evidence/negative-controls   # exit 0
node scripts/o2-verify/collect-evidence.mjs                                                   # exit 0
```

## 9. NOT_RUN и ограничения

* **Linux локально — NOT_RUN**: демон Docker на рабочей станции недоступен (как и в CORE-HANDOFF).
  Linux покрывается job'ом `verify-o2` (`ubuntu-latest`, Node 22 и 26) существующего workflow
  `.github/workflows/core-archive-verify.yml`; результат — раздел 6.
* **Полный стенд приёмки Fantasy (`node scripts/core-acceptance/run.mjs --browser`) — NOT_RUN**:
  он требует identity/allowlist кандидата и пишет в `.tmp` чужого дерева. Вместо него корпус
  прогнан собственным harness'ом на тех же 159 сценариях и тех же бандлах со сверкой **полного
  дайджеста результата** (159/159 совпадают с `o1mv.1`). Не выполнялись: покадровые проверки
  проектора реплея, worker-детерминизм и Chromium-плечо стенда Fantasy.
* **Chromium-MRE (покадрово) — NOT_RUN**: в Chrome проверена R7-матрица из 5 сценариев; оба MRE
  с покадрово-полнотой журнала проверялись на установленном архиве под Node.
* **Node 24 / другие версии, Linux-arm, другие браузеры — NOT_RUN** (недоступны в этой среде).
* **Разделение вклада S1 и S2 во время — не выполнено**: измерен только суммарный срез; S2
  подтверждён счётчиком аллокаций, но не отделён в сэмплирующем профиле (раздел 3.4).
* **Память**: снижение пикового RSS/heap не подтверждено; см. раздел 4.
* **`npx tsc --noEmit` в корне падает на базе** (6 ошибок в файле CORE-HANDOFF
  `packages/combat-core/tests/movement-journal-completeness.test.ts`). Это предсуществующее
  состояние базы `1134ffa`, не регрессия O2; файл не изменялся, гейт не ослаблялся.
* **Термальный шум ноутбука**: при первом прогоне 5 пар `zerg_rush` (контур A) разброс достигал
  ±40 %; спорная точка переизмерена с 9 парами, слабые точки помечены прямо в таблицах.
* Не выполнялись (вне задачи): O3, Rust/WASM, новый ECS, изменение формата реплея, публикация в
  npm, деплой, обновление пакета в Fantasy.

## 10. Решение

**Кандидат готов к приёмке: `@mars2050/combat-core@0.1.0-o2mv.1`, архив**
`4e4a0f36754a5a6918970e9ca06f5729fdc52ce48f3a3b90e70c46130be6b6c7`.

Основания:

1. Профиль (а не план) определил участок: главным временным аллокатором внутри тика оказался
   снимок защитного фрейма с `structuredClone` пустых списков статусов, а не предполагавшаяся
   планом выборка spatial-кандидатов (она уже работала на типизированных буферах и не
   потребовала изменений).
2. Все проверки поведения зелёные и не требуют обновления ни одного эталона: 159/159 сценариев
   Fantasy, матрица 5/5 (Windows Node 22/25/26, Chrome, Linux Node 22/26), оба MRE без
   расхождений на **установленном** архиве, неизменные golden V8/V9, идентичные хеши результатов
   во всех измеренных A/B-прогонах, 306/306 тестов ядра и 875/875 тестов Mars.
3. Публичная поверхность не изменилась: `dist/index.js` и все `.d.ts` побайтово те же, изменено
   6 файлов `dist`.
4. Эффект измерен с чередованием и односторонним перевесом на подтверждённых точках: Pure Core
   `zerg_rush` 1.250× (9/9 пар), Pure Core `massive_clash` 1.170×, Mars Compat 1.127×/1.226×
   (5/5 пар), Fantasy 1.115×–1.308× (9 пар, 6–9 из 9 в пользу кандидата).
5. Изоляция памяти защищена постоянными тестами и тремя отрицательными контролями, каждый из
   которых действительно роняет набор и после каждого рабочее дерево восстанавливается
   побайтово.

Честные ограничения (не влияют на решение, но зафиксированы): отдельный вклад S2 во время не
доказан и не заявляется; снижение пикового RSS/retained-памяти не подтверждено; точка Fantasy
`dawn-shield-marshal` имеет 6/9 из-за выбросов среды; `npx tsc --noEmit` в корне падает на базе
(6 предсуществующих ошибок в файле CORE-HANDOFF, не регрессия).

Остановка выполнена на первом проверенном O2-кандидате: O3, тригонометрия, новый ECS, новый
формат реплея, публикация пакета и обновление пакета в Fantasy не выполнялись.
