# Combat Simulator QA & Diagnostics

Симулятор боя (v2) доступен по адресу: `http://localhost:3000/simulator2`

Это изолированная песочница для тестирования, отладки и балансировки боевой системы без влияния на состояние основной базы данных. Симулятор позволяет выставлять юнитов, применять глобальные улучшения, указывать фиксированный сид (RNG) и управлять воспроизведением.

## Как читать Combat Metrics
В режиме просмотра реплея слева отображается панель метрик:
- **Tick**: Текущий шаг симуляции (текущий `MAX_TICKS` в combat config — 400).
- **Первая атака**: Тик, на котором произошел первый выстрел или удар. Позволяет оценить, как долго юниты сближаются.
- **Avg Overlap**: Среднее перекрытие хитбоксов по всем replay-сэмплам. В идеале должно быть меньше 10px. Показывает качество работы Separation (Boids).
- **Max Overlap**: Максимальное перекрытие среди всех пар юнитов за весь replay. Показывает, есть ли жесткие "застревания".
- **Avg Ratio / Max Ratio**: Нормализованная тяжесть перекрытия относительно суммы радиусов пары. Удобнее сравнивать между мелкими и крупными юнитами.
- **Severe Samples**: Количество replay-сэмплов с перекрытием 50%+ от нормализованной дистанции. Это diagnostic UI; runtime/snapshot метрики остаются главным источником QA-gate.

## Automated Movement Gates
`combat.qa-presets.test.ts` закрепляет movement regression gates для `ranged_duel`, `massive_clash` и `zerg_rush`.
Отдельный `marine_crowd_qa` сценарий закрепляет ручной repro "две группы морпехов против двух групп морпехов": он должен оставаться читаемым без blob-схлопывания и видимой дрожи.
Runtime metrics являются главным источником gate-порогов: first attack, battle duration, overlap ratio, severe overlap samples, target switches, stuck ticks и melee slot wait ticks.
Replay metrics проверяются как diagnostic mirror с tolerance, чтобы UI-панель не расходилась с runtime telemetry при допустимых отличиях sampling order.
Для ручной диагностики есть report:
- `npm run combat:metrics` — таблица по базовым movement QA presets.
- `npx tsx scripts/combat-metrics-report.ts --preset=ranged_duel --json` — JSON для выбранных presets.
- `npx tsx scripts/combat-metrics-report.ts --all` — полный report по всем simulator presets.
- `npx tsx scripts/combat-metrics-report.ts --compare=docs/combat-metrics-baseline.json` — delta к сохраненному baseline.
- `npx tsx scripts/combat-metrics-report.ts --update-baseline` — обновить baseline после намеренного изменения movement/targeting.
Если `npm run test:combat:scenarios` падает или delta подозрительная, запустите `npm run combat:qa:artifacts`: он сохранит `metrics.json`, `metrics-compare.json`, `summary.md` и sample replay actions в `artifacts/combat-qa/`.

## Управление и Debug Overlays
- **Play/Pause / Speed**: Управление скоростью от 0.5x до 4.0x.
- **Таймлайн**: Seek по tick должен ставить replay на паузу и пересобирать canvas state детерминированно из initial state + replay log.
- **Хитбоксы (Радиус)**: Отрисовка точных коллайдеров юнитов.
- **Векторы движения**: Показ желаемого направления движения. Полезно для отладки Steering.
- **Линии атак**: Отрисовка постоянных красных линий при атаке.

## Replay QA Command Split

| Command | Scope |
| --- | --- |
| `npm run test:combat:scenarios` | Runtime scenario metrics gate: simulator presets, replay actions, termination, spawn caps, and soft combat metrics. |
| `npm run test:combat:tier1` | Tier 1 role gate: deterministic role scenarios, replay-visible role signals, and non-zero carrier output. |
| `npm run combat:snapshot` | Generates committed balance-readiness reports in `docs/combat-balance-snapshot.md` and `.json`. |
| `npm run replay:visuals` | Standalone replay visual asset contract: every current combat unit has a direct manifest asset or explicit exemption. |
| `npm run test:e2e:replay` | Default Pixi replay smoke: presets, mobile fit, debug overlays, dense movement readability, direct visual assets, timeline seek, primitive event labels. |
| `npm run test:e2e:replay-pixi` | Focused Pixi replay parity/stress smoke: lazy Pixi chunk, mobile fit, overlays, seek/rewind, direct visual assets, dense movement, and zerg Crowd LOD. |
| `npm run test:e2e:replay-baseline` | Canvas screenshot baselines for stable visual states. |
| `npm run test:e2e:replay-baseline:update` | Updates committed baseline screenshots after intentional replay rendering changes. |
| `npm run test:e2e:qa` | Simulator load smoke plus replay smoke, without screenshot baseline comparison. |

Run `test:combat:scenarios` before balance work. It is a runtime contract,
not a visual test: failures mean a mechanic stopped producing the expected
replay actions, battle completion, spawn bounds, or movement metrics.

## Visual Baseline QA

Canvas-only screenshot baselines live in
`tests/e2e/simulator2-replay-baseline.spec.ts`. They use the deterministic
`transform_modes` preset and fixed simulator seed, then capture only the replay
canvas so surrounding modal UI and viewport chrome do not create noise.

Covered baseline states:

| Snapshot | State |
| --- | --- |
| `simulator2-replay-start` | Replay paused and seeked to tick 0. |
| `simulator2-replay-mid-seek` | Replay paused and seeked to a stable mid-fight tick. |
| `simulator2-replay-overlays` | Same mid-fight tick with debug overlays enabled. |

Use this command to verify committed baselines:

```bash
npm run test:e2e:replay-baseline
```

Only update snapshots after an intentional replay rendering change:

```bash
npm run test:e2e:replay-baseline:update
```

CI runs this baseline suite on Windows/Chromium because the committed Playwright
snapshots are platform-specific `*-chromium-win32.png` files.

Transient projectile target lines remain covered by
`tests/e2e/simulator2-replay.spec.ts` pixel smoke checks instead of baseline
snapshots, because their age depends on frame timing.

## Movement Visual Smoke

Dense movement readability is covered by
`tests/e2e/simulator2-replay.spec.ts` against the `ranged_duel`,
`marine_crowd_qa`, and `massive_clash` presets. The test pauses the replay,
seeks to deterministic combat ticks, enables hitbox and velocity overlays,
checks that both overlay colors are present, and compares two paused canvas
screenshots to catch visible jitter.

`marine_crowd_qa` is the canonical crowd repro: two marine squads attack two
marine squads. Use it when checking whether ranged infantry collapses into a
single shaking cluster after movement or depenetration changes.

`zerg_rush` is the canonical visual stress repro for renderer-side Crowd LOD.
It intentionally keeps the underlying replay positions unchanged, but the canvas
renderer suppresses per-unit labels/HP bars in dense buckets and draws compact
unit sprites without persistent team rings so 100+ unit fights stay readable
without field counter badges. In normal density, attacker HP bars are green and
defender HP bars are red.

`tier1_visual_qa` is the canonical direct-asset repro for early infantry. It
places the main Tier 1 human roles in one deterministic replay and verifies that
they render through their own sprite folders instead of temporary aliases or
fallback text labels. The unit-level contract is defined by
`REPLAY_VISUAL_ASSETS` in `battle-replay-visual-registry.ts` and can be checked
with `npm run replay:visuals`; `battle-replay-sprites.test.ts` keeps renderer
resolution and direction mapping covered.

`visual_alias_qa` is the canonical repro for units that previously borrowed
another unit's replay visual. It keeps `aa_turret`, `drone`, `scout_drone`,
`scavenger_buggy`, `jetpack_trooper`, `gatling_rover`, and `alien_worm` visible
in one replay so canvas and Pixi smoke tests catch regressions back to fallback
labels or wrong shared silhouettes.

Crowd LOD rules are renderer-only: `48px` density buckets render as full units
up to 6 live units, compact sprites from 7 to 15 live units, and sprite miniatures
inside connected cluster regions at 16+ live units. Circles and text labels are
fallbacks only when a unit has no resolved visual asset or the image is still
loading. Debug hitboxes and velocity vectors still use exact unit positions, so
overlays remain suitable for movement diagnostics.

Pixi uses the same Crowd LOD plan, but the renderer keeps a persistent scene:
static battlefield layers are created once, unit displays are keyed by `unit.id`,
and transient hazards/projectiles/texts use reusable pools. This prevents the
renderer from destroying and recreating the whole display tree every
frame. `test:e2e:replay-pixi` covers mobile fit, pause/seek/rewind stability,
debug overlays, the `marine_crowd_qa` repro, and the `zerg_rush` stress state.
Pixi is the default `/simulator2` replay renderer; Canvas remains selectable as
fallback and is still used by the canvas screenshot baseline suite.

This is intentionally not a screenshot baseline. It protects replay readability
after movement/depenetration tuning without making normal combat timing changes
require baseline image updates.

## Primitive Event Visual Smoke

`tests/e2e/simulator2-replay.spec.ts` also checks high-signal primitive event
labels against the `qa_primitive_events` preset. This is not a screenshot
baseline: the test seeks to deterministic ticks, plays the event tick, and
asserts that the expected label color appears on the canvas.

Use this command for the default canvas primitive event and replay overlay smoke suite:

```bash
npm run test:e2e:replay
```

Pixi replay rendering is the default `/simulator2` renderer. The first
`/simulator2` screen must still avoid Pixi chunks; `npm run test:e2e:replay`
checks that Pixi loads only after the replay opens and remains readable across
mobile, seek/rewind, overlays, dense movement, and zerg stress states.

Covered visual event groups:

| Event group | Replay actions |
| --- | --- |
| Control conversion | `control_convert` |
| Field and cleanse labels | `field_effect`, `hazard_cleanse`, `status_cleanse` |
| Barrier interaction | `barrier_spawn`, `barrier_absorb` |
| Spawn cap pressure | `spawn`, `spawn_blocked` |
| Projectile defense smoke | `projectile_intercept` |

The `qa_primitive_events` preset uses hidden QA-only upgrade modifiers. They
exercise the normal runtime upgrade pipeline but are not shown in the manual
unit upgrade panel.

## Damage / Replay Diagnostics
Новые replay-логи могут содержать подробные damage events. Визуальный replay должен использовать их для HP/text, а legacy `attack` оставлять для projectile/recoil/VFX и старых логов.

| Action | Что проверять |
| --- | --- |
| `damage` | HP уменьшается только на финальный урон после защиты/щита/статусов. |
| `shield_damage` | Щит теряет ровно поглощенную часть удара. |
| `shield_break` | Срабатывает при уходе shield HP в 0. |
| `shield_hit_block` | Персональный щит гарантированно блокирует overflow-hit и показывает отдельный блок. |
| `unit_blocked_damage` | Показывает урон, снятый защитой, armor/status reduction или reactive armor; при armor pierce должен быть ниже baseline. |
| `lifesteal` | Лечение считается от фактически нанесенного HP/shared урона. |
| `ramp_charge` | Focus-fire юнит наращивает множитель только по той же primary цели. |
| `charge_damage` | Movement-distance бонус применяется только к primary hit и сбрасывается после атаки. |
| `percent_hp_damage` | Anti-giant бонус добавляется к primary hit до mitigation и не появляется у обычных/secondary ударов. |
| `projectile_intercept` | Projectile-defense юнит сбил interceptable hit до shield/HP damage. |
| `control_convert` | Цель визуально переходит под контроль другой команды. |
| `trigger_effect` | HP/attack/death/kill trigger заметен отдельно от обычного урона. |
| `periodic_ability` | Периодический залп/спавн виден как отдельное событие, не только как damage/spawn. |
| `transform_mode` | Role-swap transform виден как отдельное событие. |
| `stealth_change` | Movement stealth включился/сбросился, reveal и атака читаются в replay. |
| `barrier_absorb` | Barrier dome поглощает урон отдельным текстом, не смешиваясь с shield HP. |
| `hazard_cleanse` | Cleanse field удалил hazard/status и оставил отдельный replay marker. |
| `on_kill` | On-kill эффекты появляются только после подтвержденной смерти, не после resurrection. |
| `stance_change` | Siege/entrenchment режим развернулся или сбросился перед движением. |
| `mode_change` | Ground/air режим переключился: `air` при перемещении, `ground` перед атакой. |
| `burrow_change` | Юнит вошел в underground movement state, вышел перед атакой или был раскрыт reveal. |
| `hazard_spawn` + `statusType: smoke` | Smoke field появился как suppression-зона без прямого урона; accuracy loss виден через меньший `damage`. |

## Known Limitations
- Анимации выстрелов интерполируются и могут не всегда точно совпадать с физическим тиком попадания на скорости 4.0x.
- Оверлеи векторов рисуются только если юнит перемещается (deltaX/deltaY > 0).
- Симулятор работает полностью на клиенте, поэтому при симуляции 200+ юнитов может быть небольшая задержка перед началом воспроизведения.

---

## Manual QA Matrix
Для ручной проверки качества работы симуляции используйте следующие сценарии (и пресеты):

| Сценарий | Как настроить | Ожидаемый результат | Что проверять |
|----------|---------------|---------------------|---------------|
| **1. Melee Blob (Зерг Раш)** | Пресет "Зерг Раш" (Много ближников) | Юниты плавно обтекают друг друга. Мертвые юниты перестают блокировать проход. | Нет дерганий, Avg Overlap < 8px. |
| **2. Ranged Focus Fire** | Пресет "Дуэль стрелков" | Дальнобойные юниты не подходят вплотную. Огонь концентрируется логично. | Нет бесконечной смены целей. Sticky aggro работает. |
| **3. Obstacles Corridor** | Разместить юнитов по разные стороны кратера | Юниты используют Flow Field для обхода препятствия. | Нет застревания в кратерах. PushForce препятствий работает. |
| **4. AoE Cluster** | Толпа ближников против гранатометчика | AoE урон наносится всем в радиусе поражения. | Корректный подсчет мульти-урона и визуальные цифры. |
| **5. Shield / Status** | Юниты с щитами против EMP | Щиты поглощают урон, EMP вешает визуальный статус. | Отрисовка эффекта "БЛОК" и синих кругов EMP. |
| **6. 100+ Units Stress** | Пресет "Стенка на стенку (100+)" | Симуляция рассчитывается без падения вкладки. | Плавный FPS реплея, корректные векторы. |
| **7. Deterministic Replay** | Ввести одинаковый Seed дважды | Идентичный результат (победитель, остаток HP) 100% случаев. | Сравнить метрики и выживших. |
| **8. Shield Overflow** | Сильный одиночный удар по юниту с малым щитом | Остаток урона проходит в HP после разрушения щита. | Есть `shield_damage`, `shield_break`, затем `damage`. |
| **8B. Shield Breaker** | Railgun/Plasma/Missile Buggy с `shield_breaker_rounds` против щитовой цели | Щит теряет больше HP, чем обычный удар той же силы; без щита HP-урон не растет. | `shield_damage` выше base hit, `damage` появляется только после пробития щита. |
| **8C. Armor Pierce** | Railgun/Sniper/Plasma с `armor_piercing_rounds` против Wall/Behemoth | Defense mitigation ниже baseline, но урон по цели без брони не растет. | `unit_blocked_damage` ниже, `damage` выше; нет `status_apply` для `armor_broken`. |
| **8D. Anti-Summoner** | Bounty Hunter/Sniper/Stealth Operative с `anti_summoner_protocol` против Drone Carrier / Mobile Factory / Hologram Projector | Урон выше по summoner, spawned и temporary целям, но не по обычному frontline. | `damage` выше baseline; spawned/temporary цели имеют target tag `summoned`; нет нового status. |
| **8E. Anti-Stealth Reveal** | Officer/Scout/Bounty Hunter с `sensor_suite` против Stealth Operative | Скрытая цель становится доступна targeting до первой атаки, обычные цели не получают reveal. | Есть `status_apply` `revealed` на stealth цели; после reveal стрелки выбирают stealth по обычным targeting rules. |
| **8F. Accuracy Suppression** | Smoke field или тестовый smokeOnAction с `accuracySuppression`; повторить с `thermal_optics` | Без optics удар становится glancing damage; с optics штраф ниже, clean-hit DPS не растет. | Есть `status_apply` `accuracy_reduced`; последующий `damage` ниже baseline, но без случайных miss events. |
| **9. Control Statuses** | EMP/хакер/крио против тяжелого юнита | EMP/hacked блокируют действия, slow меняет скорость. | `status_apply`, `status_expire`, отсутствие атак под контролем. |
| **10. Weapon Shapes** | Огнемет, ионный излучатель, артиллерия, плазмо-танк | Cone/beam/barrage/chain выбирают цели детерминированно. | Нет случайного порядка целей; VFX совпадает с action stream. |
| **11. Side Weapons** | Goliath против нескольких целей | Primary цель получает основной удар, side targets получают отдельный урон. | Есть `side_weapon_attack`; side weapons не копируют primary statuses. |
| **12. Ramp Damage** | Ion Crawler долго стреляет в одну heavy цель | Primary урон растет до cap, при смене цели сбрасывается. | `ramp_charge` значения 1 → 1.25 → ... |
| **13. Charge Damage** | Scavenger Buggy разгоняется перед первым контактом | Primary hit получает capped burst, затем charge сбрасывается. | Есть `charge_damage`, затем `damage`; secondary hits не получают бонус. |
| **14. Percent HP Damage** | Railgun Walker против Behemoth/Titan | Дополнительный урон растет от max HP цели, но упирается в cap. | Есть `percent_hp_damage`, затем обычный `damage`. |
| **15. Projectile Interception** | Shield Emitter рядом с целью против Missile Buggy / Artillery Crawler | Первый дальний explosive/barrage hit блокируется до shield/HP. | Есть `projectile_intercept`; нет `damage` для сбитого удара. |
| **16. On-kill Effects** | Stealth Operative добивает цель | После kill сбрасывается cooldown и применяется self-heal. | Есть `on_kill`; нет срабатывания при revive/resurrection. |
| **17. Summon Caps / Decoys** | Drone Carrier, Mobile Factory, Hologram Projector | Summons не бесконечны, temporary units исчезают по таймеру. | Есть `spawn_blocked`, temporary death не ломает replay. |
| **18. Stance Transforms** | Artillery Crawler против дальней static цели | Артиллерия сначала разворачивается, затем стреляет; при необходимости движения сбрасывает режим. | Есть `stance_change`; range/cooldown меняются только в deployed mode. |
| **18B. Mobility Mode Swap** | Jetpack Trooper против дальней наземной цели; повторить против dedicated AA | Юнит взлетает во время сближения, приземляется перед melee атакой, anti-air видит его только в airborne window. | Есть `mode_change` `air`/`ground`; replay показывает ВЗЛЕТ/ПОСАДКА; ground weapons могут атаковать после посадки. |
| **18C. Burrow Movement** | Shock Trooper или Alien Bug с `subterranean_blitz` против дальней цели; повторить рядом с Radar Zepplin reveal | Юнит уходит под землю при движении, получает меньше входящего урона, выходит перед атакой или при reveal. | Есть `burrow_change` со значениями 1/0; `damage` по burrowed цели ниже baseline, после `revealed` reduction пропадает. |
| **19. Smoke Fields** | Тестовый smokeOnAction юнит или будущий smoke upgrade | Smoke hazard режет range/output/accuracy у наземных юнитов внутри радиуса, не дамажит напрямую. | Есть `hazard_spawn` smoke и `status_apply`; flyers не получают smoke suppression. |
| **20. Movement Stealth** | Пресет "Стелс / Радар" | Stealth unit скрыт при движении, reveal возвращает его в targeting. | Есть `stealth_change`, затем `status_apply` `revealed`; после атаки stealth сбрасывается. |
| **21. Projectile Barrier** | Пресет "Ракеты / Щит" | Shield Emitter перехватывает первый дальний explosive/barrage hit. | Есть `projectile_intercept`; защищенная цель не получает `damage` от сбитого удара. |
| **22. Summon Caps** | Пресет "Призывы / Лимиты" | Factory/carrier/hologram создают units и не уходят в бесконечный snowball. | Есть `spawn`; число active summons ограничено, бой завершается без runaway chain. |
| **23. Control / EMP** | Пресет "Контроль / EMP" | Hack/EMP units выполняют полезные действия без прямого урона. | Есть `status_apply` `hacked`/`emp`; controlled/disabled цели временно теряют нормальное поведение. |
| **24. Transform Modes** | Пресет "Режимы движения" | Jetpack меняет air/ground window, artillery разворачивается перед стрельбой. | Есть `mode_change`, `stance_change`; дальность и targetability соответствуют режиму. |
| **25. Cleanse Status** | Пресет "Очищение статусов" | Engineer очищает harmful statuses с союзников в радиусе. | Есть `status_cleanse`; burn/acid/slow не держатся бесконечно рядом с support. |
| **26. Tier 1 Visual Coverage** | Пресет "QA: визуалы T1" | Marine, shock trooper, flamethrower, grenadier, heavy gunner, sapper, officer читаются как разные юниты. | Нет временных fallback-labels вместо спрайтов; каждый T1 infantry использует свой direct asset. |
| **27. Former Alias Visual Coverage** | Пресет "QA: бывшие алиасы" | AA turret, drones, buggy, jetpack, gatling rover, alien worm читаются как разные юниты. | Нет replay-алиасов на чужие silhouette; каждый бывший alias использует свой direct SVG strip. |
