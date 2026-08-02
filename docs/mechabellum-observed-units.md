# Mechabellum: observed unit reference

This document records unit data and design observations taken from the supplied
Russian-language hangar screenshots dated 2026-08-01, with supplemental
tooltips dated 2026-08-02. It is a reference for Mars2050 combat design, not a
proposal to copy Mechabellum balance directly. The current catalog contains 32
observed units and 231 technology options.

## Reading the tables

- Baseline values are recorded at rank 1.
- HP and attack are per model, not totals for the whole squad.
- Cost is the value shown in the Mechabellum hangar.
- `Ground` and `Air + ground` describe available target layers.
- The branch matrix is a design summary; the complete catalog below is the
  exhaustive union of every option visible in the supplied screenshots.
- `TP 1` means that only a one-technology-point unlock marker was visible; it
  is not an observed in-battle credit cost.
- A later Mechabellum balance patch may make these values obsolete.

## Observed tier distribution

The in-game roster screen groups the 32 observed units into four tiers. These
tiers are roster categories, not direct price bands: Tier I alone contains
units costing 100, 200, and 400 credits.

| Tier | Units                                                                                                                             | Count |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- | ----: |
| I    | Crawler; Fang; Hound; Void Eye; Arclight; Marksman; Vortex; Mustang; Sledgehammer; Steel Ball; Fire Badger; Tarantula; Sabertooth |    13 |
| II   | Stormcaller; Rhino; Wasp; Phantom Ray; Phoenix; Hacker; Farseer; Scorpion; Typhoon; Wraith                                        |    10 |
| III  | Vulcan; Melting Point; Fortress; Sandworm; Raiden; Overlord                                                                       |     6 |
| IV   | War Factory; Mountain; Abyss                                                                                                      |     3 |

## Baseline roster

| Unit          | Russian name   | Cost | Models |      HP | Speed |  Attack | Splash | Interval | Range | Targets      | Baseline battlefield job                                                                           |
| ------------- | -------------- | ---: | -----: | ------: | ----: | ------: | -----: | -------: | ----: | ------------ | -------------------------------------------------------------------------------------------------- |
| Crawler       | Ползун         |  100 |     24 |     263 |    16 |      79 |      0 |    0.6 s | Melee | Ground       | Fast melee screen that becomes dangerous while enough bodies survive.                              |
| Fang          | Клык           |  100 |     18 |     117 |     6 |      63 |      0 |    1.5 s |    75 | Air + ground | Cheap ranged screen with broad target access and weak individual bodies.                           |
| Hound         | Гончая         |  100 |      5 |     879 |    10 |     246 |      6 |    2.4 s |    70 | Ground       | Medium-range screen clear with fewer, tougher models than a swarm.                                 |
| Void Eye      | Глаз пустоты   |  100 |      3 |   1,522 |     8 |     995 |      0 |    3.3 s |   100 | Ground       | High single-target damage against heavy units; wastes output on screens.                           |
| Arclight      | Светоч         |  100 |      1 |   4,813 |     7 |     365 |      7 |    0.9 s |    95 | Ground       | Durable single-model screen clear and early battle-line anchor.                                    |
| Marksman      | Снайпер        |  100 |      1 |   1,622 |     8 |   2,329 |      0 |    3.1 s |   140 | Air + ground | Long-range precision damage against low-model, high-value squads.                                  |
| Vortex        | Вихрь          |  100 |      1 |   7,425 |     8 |   1,309 |      0 |    1.5 s |    85 | Ground       | Durable medium-range generalist specialized against medium squads.                                 |
| Mustang       | Мустанг        |  200 |     12 |     343 |    16 |      36 |      0 |    0.4 s |    95 | Air + ground | Fast rapid-fire swarm, cleanup unit, and baseline anti-air.                                        |
| Sledgehammer  | Кувалда        |  200 |      5 |   3,478 |     7 |     608 |      5 |    4.5 s |    95 | Ground       | Heavy tank pack with small-area burst and strong formation presence.                               |
| Stormcaller   | Буревестник    |  200 |      4 |   1,149 |     6 |     772 |    5.5 |    6.6 s |   180 | Ground       | Extreme-range rocket artillery with large overkill and a close-range dead zone.                    |
| Steel Ball    | Стальной шар   |  200 |      4 |   4,571 |    16 | 2-2,605 |      0 |    0.2 s |    45 | Ground       | Fast anti-heavy contact unit whose beam ramps on one durable target.                               |
| Fire Badger   | Огневик        |  400 |      3 |  12,666 |     9 |      81 |      7 |    0.1 s |    75 | Ground       | Durable sustained anti-swarm flame platform at close and medium range.                             |
| Sabertooth    | Саблезуб       |  200 |      1 |  14,886 |     8 |   6,881 |      5 |    3.2 s |    95 | Ground       | Heavy single-model tank with powerful burst and modest area damage.                                |
| Tarantula     | Тарантул       |  200 |      1 |  14,773 |     8 |     496 |      5 |    0.6 s |    80 | Ground       | Flexible heavy rapid-fire robot without a hard baseline specialization.                            |
| Rhino         | Носорог        |  200 |      1 |  19,297 |    16 |   3,560 |      6 |    0.9 s | Melee | Ground       | Fast heavy melee breaker that deals large area damage after reaching contact.                      |
| Hacker        | Хакер          |  200 |      1 |   3,249 |     8 |     600 |      0 |    0.3 s |   110 | Ground       | Long-range controller that captures enemy units but pauses between successful takeovers.           |
| Wasp          | Оса            |  200 |     12 |     311 |    16 |     202 |      0 |    1.4 s |    50 | Air + ground | Fast air swarm with high combined output and very fragile individual models.                       |
| Phoenix       | Феникс         |  400 |      2 |   4,473 |    16 |   8,442 |      0 |    3.4 s |   120 | Air + ground | Long-range precision aircraft that deletes valuable heavy targets with slow, powerful shots.       |
| Phantom Ray   | Фантомный луч  |  200 |      3 |   3,412 |    16 |   1,087 |      3 |    3.0 s |    65 | Air + ground | Mobile medium aircraft that delivers close-range missile bursts with modest splash.                |
| Wraith        | Призрак        |  300 |      1 |  14,115 |    10 |     381 |      8 |    1.6 s |    60 | Air + ground | Heavy short-range aircraft whose multiple hovering guns provide sustained area damage.             |
| Scorpion      | Скорпион       |  300 |      1 |  18,632 |     7 |  10,650 |     15 |    4.5 s |   100 | Ground       | Heavy cannon platform with enormous burst and splash but a very slow firing cadence.               |
| Farseer       | Провидец       |  300 |      1 |  11,991 |    16 |   1,348 |      8 |    2.0 s |   125 | Air + ground | Fast large support vehicle combining missile damage with protection and utility options.           |
| Typhoon       | Тайфун         |  300 |      2 |   9,529 |     9 |      88 |      5 |    0.2 s |   100 | Air + ground | Durable universal gatling pair specialized in suppressing light ground and air squads.             |
| Vulcan        | Вулкан         |  800 |      1 |  90,837 |     6 |     225 |     15 |    0.1 s |    95 | Ground       | Giant flamethrower that erases dense ground swarms through continuous area damage.                 |
| Melting Point | Плавильня      |  400 |      1 |  30,907 |     6 | 2-7,952 |      3 |    0.2 s |   115 | Air + ground | Giant ramping-beam platform specialized in destroying high-HP targets after maintaining lock.      |
| Fortress      | Крепость       |  400 |      1 |  43,938 |     6 |   6,524 |      5 |    1.8 s |   100 | Ground       | Giant line anchor with heavy cannon damage and optional shielding, spawning, or anti-air support.  |
| Sandworm      | Песчаный червь |  400 |      1 |  48,645 |    16 |   9,726 |     12 |    2.5 s | Melee | Ground       | Fast burrowing melee giant that crosses the field safely and erupts into clustered ground units.   |
| Raiden        | Райден         |  400 |      1 |  16,065 |    10 |   5,027 |      0 |    4.6 s |   110 | Air + ground | Flying lightning giant that strikes three separate targets and can branch into chain or fork fire. |
| Overlord      | Владыка        |  500 |      1 |  21,339 |    10 |   4,742 |      7 |    4.6 s |   120 | Air + ground | Flying giant artillery carrier that can add ground guns, protection, mobility, or Wasp production. |
| War Factory   | Военный завод  |  800 |      1 | 113,593 |     6 |   7,520 |    4.5 |    1.8 s |   100 | Ground       | Titanic mobile production platform whose chosen factory line changes the army it generates.        |
| Abyss         | Бездна         |  800 |      1 |  66,955 |    10 |   3,859 |      5 |    4.0 s |   100 | Air + ground | Flying laser titan built around wide-area sweeps, periodic ground pressure, and support payloads.  |
| Mountain      | Гора           |  800 |      1 | 136,657 |     6 |   5,899 |      5 |    2.0 s |   100 | Ground       | Extremely durable ground titan whose doctrines trade cadence or damage for artillery-scale reach.  |

## Observed technology branches

| Unit          | Core reinforcement                                                | Counter-specialization                                                                         | Role transformation                                                         | Natural failure mode                                                                                      |
| ------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Crawler       | Mechanical Rage                                                   | Acid Explosion                                                                                 | Replication; Underground Blitz; Impact Drill                                | Area damage removes the model-count advantage before contact.                                             |
| Fang          | Range; Mechanical Rage; Portable Shield                           | Armor-Piercing Bullets                                                                         | Ignition                                                                    | Splash, rapid screen clear, and flat block punish many weak shots.                                        |
| Hound         | Range; Armor Enhancement                                          | Fire Extinguisher                                                                              | Incendiary Bomb; Chamber Compression                                        | Dedicated anti-heavy damage and long-range pressure.                                                      |
| Void Eye      | Range; Energy Shield                                              | Charged Shot                                                                                   | Air Mode; Energy Absorption                                                 | Cheap bodies absorb slow high-damage attacks through overkill.                                            |
| Arclight      | Armor Enhancement; Range                                          | Anti-Air Ammunition; Electromagnetic Shot                                                      | Elite Marksman; Shock Wave                                                  | Precision anti-heavy fire deletes its single large model.                                                 |
| Marksman      | Range; Double Shot                                                | EMP Shot; Air Specialization                                                                   | Fast Reload; summon four Fangs; Assault Mode                                | Swarms, flankers, and forced close combat.                                                                |
| Vortex        | Range; Emergency Armor; Field Maintenance                         | Electromagnetic Cloud                                                                          | Mobile Power Station; EM Duplicate; Accumulator Shield; Network Integration | Base form is less efficient against extreme swarms and dedicated anti-heavy fire.                         |
| Mustang       | Range; Armor-Piercing Bullets                                     | Air Specialization; Flare Rounds; Missile Interceptor                                          | High-Explosive Ammunition                                                   | Splash damage and armor that invalidates many small hits.                                                 |
| Sledgehammer  | Field Maintenance; Armor Enhancement                              | EMP Shot; Armor-Piercing Shells                                                                | Damage Distribution; Mechanical Rage                                        | Dedicated anti-heavy damage, artillery, and effects that break the linked formation.                      |
| Stormcaller   | Range                                                             | EMP Explosion; Heavy Missile counters interception                                             | Incendiary Bomb; Weapon Overload; High-Explosive Ammunition                 | Fast contact, flank attacks, minimum range, and missile interception.                                     |
| Steel Ball    | Energy Absorption; Armor Enhancement                              | Fortified Target Lock                                                                          | Damage Distribution; Mechanical Division; Kinetic Charge                    | Screens and control prevent the beam from remaining on the intended heavy target.                         |
| Fire Badger   | Field Maintenance; Incinerating Fire                              | Ignition blocks healing                                                                        | Napalm; Burning Charge; Counterfire                                         | Long-range fire and high single-target damage before it reaches effective range.                          |
| Sabertooth    | Field Maintenance; Range; Double Shot                             | Missile Interceptor                                                                            | Secondary Armament; Field Trench                                            | Screens waste heavy shots; anti-heavy pressure punishes the single model.                                 |
| Tarantula     | Field Maintenance; Armor Enhancement; Range                       | Armor-Piercing Bullets; Anti-Air Ammunition; High-Explosive Ammunition                         | Spider Mines; Mechanical Rage                                               | A generalist loses efficiency to a correctly chosen specialist.                                           |
| Rhino         | Field Maintenance; Power Armor; Armor Enhancement; Photon Coating | Whirlwind against crowds                                                                       | Final Blitz; Wreckage Recycling; Mechanical Rage; Combat Development        | Kiting, control, screening, and anti-heavy burst before or during entry.                                  |
| Hacker        | Barrier; Range                                                    | Enhanced Control; Electromagnetic Interference                                                 | Multi-Control                                                               | Numerous cheap bodies, interruption, and focus fire exploit the pause between captures.                   |
| Wasp          | Energy Shield; Range; Elite Marksman                              | Ground Specialization; Electromagnetic Shot; Armor-Piercing Bullets; High-Explosive Ammunition | Jump Drive; Ignition                                                        | Anti-air splash and rapid fire remove models and collapse the squad's combined output.                    |
| Phoenix       | Energy Shield; Range; Elite Marksman                              | Charged Shot; Electromagnetic Shot                                                             | Jump Drive                                                                  | Screens absorb high-overkill shots while dedicated anti-air attacks only two models.                      |
| Phantom Ray   | Energy Shield; Cloaking Coat                                      | Ground Guidance; High-Explosive Ammunition                                                     | Sticky Oil Bomb                                                             | Its short engagement envelope exposes it to anti-air focus and interception.                              |
| Wraith        | Armor Enhancement; Field Maintenance; Range                       | Degeneration Beam; High-Explosive Ammunition                                                   | Hovering Artillery Array; Land Cruiser                                      | Dedicated anti-heavy anti-air fire exploits one large model and its short base range.                     |
| Scorpion      | Field Maintenance; Armor Enhancement; Range                       | Acid Attack; Double Shot; Convergent Fire                                                      | Siege Mode                                                                  | Air units, fast contact, dispersed screens, and slow-cadence overkill.                                    |
| Farseer       | Photon Emission; Range; Search Radar                              | Missile Interceptor; Electromagnetic Blast                                                     | Support loadout changes its protection and control emphasis                 | Focus fire removes both a combat body and the support effects concentrated on it.                         |
| Typhoon       | Reactive Armor; Field Trench; Maintenance Array                   | Debris Detonation                                                                              | Reassembly in Place                                                         | Flat damage block and anti-heavy burst punish its many small hits and two large bodies.                   |
| Vulcan        | Range; Scorching Fire                                             | Incendiary Bomb; Sticky Oil Bomb                                                               | Best Partner                                                                | Air units, long-range fire, percentage damage, and dedicated anti-giant beams.                            |
| Melting Point | Range; Armor Enhancement; Energy Diffusion                        | Electromagnetic Barrage                                                                        | Crawler Production                                                          | Screens reset beam ramp, while control and fast contact deny sustained target lock.                       |
| Fortress      | Barrier; Range                                                    | Anti-Air Barrage                                                                               | Fang Production; Weapon Overload                                            | Screens waste heavy shots; anti-giant beams, percentage damage, and control bypass its anchor role.       |
| Sandworm      | Mechanical Rage; Armor Enhancement; Underground Maintenance       | Anti-Air; Sandstorm                                                                            | Mechanical Division; Replication; Strike                                    | Air units before Anti-Air and concentrated anti-giant fire during its exposed surface window.             |
| Raiden        | Range; Energy Shield                                              | Ionization; Electromagnetic Shot                                                               | Fork; Chain                                                                 | Dedicated anti-air focus exploits its single model and long base attack interval.                         |
| Overlord      | Range; Armor Enhancement; Field Maintenance; Photon Emission      | High-Explosive Ammunition; Overlord Artillery                                                  | Mothership; Jump Drive; Weapon Overload                                     | Anti-air and percentage damage remove an expensive combat body together with its support package.         |
| War Factory   | Range; Armor Enhancement; Photon Coating                          | Missile Interceptor; High-Explosive Ammunition                                                 | Phoenix, Steel Ball, or Sledgehammer Production; Weapon Overload            | Air pressure, percentage damage, and control punish the extreme cost concentrated in one ground body.     |
| Abyss         | Range; Photon Coating                                             | Disintegration; Swarm Missiles                                                                 | Dark Companion; Wreckage Recycling; Vertical Deployment                     | Dedicated anti-air and anti-titan damage can remove its periodic abilities before they repay the cost.    |
| Mountain      | Mountain Coating; Photon Loop                                     | Long-Range Ammunition; Anti-Air Ammunition                                                     | Applied Missile; Saturation Bombardment; Smoke Bomb                         | Air unless it sacrifices `40%` attack for Anti-Air Ammunition, plus percentage damage and close pressure. |

## Complete observed technology catalog

This is the union of all technology loadouts shown in the supplied screenshots.
Costs are the orange in-battle values shown in the tooltip. Every visible option
now has a captured tooltip; Crawler's Loose Formation is the sole entry for
which the screenshots show a technology-point marker instead of an orange
in-battle cost.

### Crawler / Ползун

| Technology           | Cost | Observed effect                                                                                                         | Screenshot |
| -------------------- | ---: | ----------------------------------------------------------------------------------------------------------------------- | ---------- |
| Механическая ярость  |  100 | Speed `+5`; attack interval `-0.2 s`.                                                                                   | 16:25:30   |
| Репликация           |  250 | Uses enemies to create additional Crawlers; the captured tooltip gives no further formula.                              | 16:25:43   |
| Подземный блиц       |  350 | Speed `+3`; burrows when no enemy is within `50 m`, takes `45%` less damage while burrowed, and emerges near the enemy. | 16:25:53   |
| Кислотный взрыв      |  100 | On death creates a `9 m` acid pool; affected units lose `3%` HP/s and take `+250%` attack damage.                       | 16:26:06   |
| Ударный бур          |  150 | Attack `+125%`.                                                                                                         | 16:26:16   |
| Свободное построение | TP 1 | HP `-40%`; the squad uses a looser formation.                                                                           | 16:26:27   |

### Fang / Клык

| Technology           | Cost | Observed effect                                                                           | Screenshot |
| -------------------- | ---: | ----------------------------------------------------------------------------------------- | ---------- |
| Воспламенение        |  150 | Attacks ignite the target squad for `2 s`; affected units lose `6%` HP/s and cannot heal. | 16:28:31   |
| Увеличение дальности |  300 | Range `+40`.                                                                              | 16:28:40   |
| Механическая ярость  |  250 | Speed `+5`; attack interval `-0.5 s`.                                                     | 16:28:51   |
| Портативный щит      |  500 | Every model gains a shield equal to its HP that blocks at least one hit.                  | 16:29:19   |
| Бронебойные пули     |  100 | Attack `+50%`.                                                                            | 16:29:27   |
| Гранатомет           |  150 | Range `+10`, splash `7 m`; can no longer target air.                                      | 16:29:38   |

### Hound / Гончая

| Technology           | Cost | Observed effect                                                                         | Screenshot                         |
| -------------------- | ---: | --------------------------------------------------------------------------------------- | ---------------------------------- |
| Увеличение дальности |  300 | Range `+40`.                                                                            | 16:31:41                           |
| Огнетушитель         |  200 | Removes fire, acid, and smoke ground effects within `40 m`.                             | 16:31:49                           |
| Зажигательная бомба  |  250 | Every `16 s` launches one incendiary bomb; maximum range `160 m`, minimum range `40 m`. | 16:31:58                           |
| Усиление брони       |  250 | HP `+20%`; blocks `60` damage plus another `60` per rank.                               | 16:32:06                           |
| Компрессия камеры    |  300 | Attack interval `+0.6 s`; attack grows by `65%` per second and resets after firing.     | 16:32:16; confirmed 08-02 13:03:38 |

### Void Eye / Глаз пустоты

| Technology             | Cost | Observed effect                                                                           | Screenshot |
| ---------------------- | ---: | ----------------------------------------------------------------------------------------- | ---------- |
| Увеличение дальности   |  300 | Range `+40`.                                                                              | 16:48:53   |
| Энергетический щит     |  250 | Gains a shield equal to unit HP that blocks at least one hit.                             | 16:49:00   |
| Заряженный выстрел     |  100 | Attack `+120%`; attack interval `+25%`.                                                   | 16:49:08   |
| Воздушный режим        |  150 | Becomes flying and can attack air; speed `+3`, range `-15`.                               | 16:49:18   |
| Поглощение энергии     |   50 | HP `+60%`; damage dealt is converted into HP.                                             | 16:49:27   |
| Подавление выстрелов   |  100 | Range `+10`; hits reduce the target's range by `30%` for `3.5 s`.                         | 16:49:35   |
| Электромагнитная броня |  300 | Attackers receive EMP: technologies are disabled and speed is reduced by `40%` for `3 s`. | 16:49:44   |

### Arclight / Светоч

| Technology               | Cost | Observed effect                                                                                        | Screenshot |
| ------------------------ | ---: | ------------------------------------------------------------------------------------------------------ | ---------- |
| Увеличение дальности     |  300 | Range `+40`.                                                                                           | 16:58:27   |
| Электромагнитный выстрел |  400 | Hits apply EMP, disabling technologies and reducing movement speed by `40%`; duration was not visible. | 16:58:35   |
| Заряженный выстрел       |  100 | Attack `+300%`; attack interval `+35%`.                                                                | 17:05:18   |
| Усиление брони           |  100 | HP `+50%`; blocks `60` damage plus another `60` per rank.                                              | 17:05:44   |
| Зенитные боеприпасы      |  300 | Can target air units.                                                                                  | 17:05:51   |
| Элитный Снайпер          |  400 | Per rank: range `+5`, attack `+17%`.                                                                   | 17:05:56   |
| Ударная волна            |  250 | Range `-5`; attacks deal `75` shockwave damage in a `30 m` radius around the target.                   | 17:06:04   |

### Marksman / Снайпер

| Technology               | Cost | Observed effect                                                                                        | Screenshot     |
| ------------------------ | ---: | ------------------------------------------------------------------------------------------------------ | -------------- |
| Двойной выстрел          |  250 | Fires two bullets per attack; reload time `+15%`.                                                      | 17:07:22       |
| Увеличение дальности     |  300 | Range `+40`.                                                                                           | 17:07:29       |
| Быстрая перезарядка      |  150 | Attack interval `-50%`; attack `-60%`.                                                                 | 17:07:36       |
| Электромагнитный выстрел |  250 | Hits apply EMP, disabling technologies and reducing movement speed by `40%`; duration was not visible. | 17:07:48       |
| Элитный Снайпер          |  400 | Per rank: range `+5`, attack `+17%`.                                                                   | 08-02 13:03:24 |
| Стрелковый отряд         |  300 | Summons four same-rank Fangs at battle start.                                                          | 17:07:53       |
| Штурмовой режим          |  200 | HP `+500%`, speed `+3`, attack `+60%`, splash `9 m`, range `-70`.                                      | 17:08:03       |
| Воздушная специализация  |  250 | Against air: attack `+90%`, range `+30`.                                                               | 17:08:13       |

### Vortex / Вихрь

| Technology               | Cost | Observed effect                                                                                                                          | Screenshot |
| ------------------------ | ---: | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Увеличение дальности     |  300 | Range `+40`.                                                                                                                             | 17:23:39   |
| Мобильная электростанция |  250 | Own range `+10`; allied ground units within `100 m` gain `+30%` attack; multiple auras do not stack.                                     | 17:23:46   |
| Электромагнитное облако  |  400 | Attacks apply EMP to the target and enemies within `10 m`.                                                                               | 17:23:55   |
| Электромагнитный двойник |  350 | Spawns a level-1 Vortex mirage behind the unit at battle start; it has `1` HP and `30%` normal attack.                                   | 17:24:05   |
| Щит аккумулятора         |  300 | Every five attacks deploys a `40 m` shield; each next shield needs five more attacks. Shield HP is `2,000` plus `2,000` per Vortex rank. | 17:24:13   |
| Интеграция с сетями      |  250 | Each linked Vortex within `35 m` grants `+35%` attack, capped at `+105%`.                                                                | 17:24:24   |
| Аварийная броня          |  150 | First time HP falls below `50%`, becomes immune and untargetable for `4 s`; does not trigger on a lethal hit.                            | 17:24:32   |
| Полевое обслуживание     |  150 | HP `+30%`; regenerates `4.5%` max HP/s while taking damage.                                                                              | 17:24:41   |

### Mustang / Мустанг

| Technology                    | Cost | Observed effect                                                                                                                                               | Screenshot |
| ----------------------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Перехватчик ракет             |  200 | Intercepts enemy missiles within `150 m`; cannot stop field abilities, and sustained interception loses efficiency. Effect is independent of attack and rank. | 17:27:43   |
| Увеличение дальности          |  300 | Range `+40`.                                                                                                                                                  | 17:27:50   |
| Осколочно-фугасные боеприпасы |   50 | Splash `+7 m`; attack `-30%`.                                                                                                                                 | 17:27:57   |
| Воздушная специализация       |  300 | Against air: attack `+90%`, range `+30`.                                                                                                                      | 17:28:06   |
| Бронебойные пули              |  250 | Attack `+50%`.                                                                                                                                                | 17:28:14   |
| Раунды отбраковки             |  250 | Instantly destroys a target below `320` current HP plus `200` per additional Mustang rank; attack `-35%`.                                                     | 17:28:21   |

### Sledgehammer / Кувалда

| Technology               | Cost | Observed effect                                                                                        | Screenshot |
| ------------------------ | ---: | ------------------------------------------------------------------------------------------------------ | ---------- |
| Полевое обслуживание     |  200 | HP `+30%`; regenerates `4.5%` max HP/s while taking damage.                                            | 17:30:23   |
| Распределение ущерба     |  200 | Links adjacent Sledgehammers, grants `+120%` HP, and distributes damage evenly.                        | 17:30:32   |
| Механическая ярость      |  250 | Speed `+6`; attack interval `-1 s`.                                                                    | 17:30:42   |
| Увеличение дальности     |  300 | Range `+40`.                                                                                           | 17:30:52   |
| Электромагнитный выстрел |  350 | Hits apply EMP, disabling technologies and reducing movement speed by `40%`; duration was not visible. | 17:30:59   |
| Бронебойные пули         |  100 | Attack `+250%`; attack interval `+30%`.                                                                | 17:31:07   |
| Усиление брони           |  250 | HP `+35%`; blocks `60` damage plus another `60` per rank.                                              | 17:31:16   |

### Stormcaller / Буревестник

| Technology                    | Cost | Observed effect                                                                                        | Screenshot |
| ----------------------------- | ---: | ------------------------------------------------------------------------------------------------------ | ---------- |
| Зажигательная бомба           |  350 | Range `-20`; attacks ignite a `5.5 m` area for `15 s`, dealing `270` damage/s. Allies can also be hit. | 17:32:04   |
| Увеличение дальности          |  300 | Range `+40`.                                                                                           | 17:32:13   |
| Перегрузка орудий             |  250 | Attack interval `-50%`, range `-40`, speed `+5`.                                                       | 17:32:18   |
| Осколочно-фугасные боеприпасы |  150 | Splash `+5 m`; attack `-50%`.                                                                          | 17:32:24   |
| Электромагнитный взрыв        |  300 | Hits apply EMP, disabling technologies and reducing movement speed by `40%`; duration was not visible. | 17:32:35   |
| Тяжелая ракета                |  200 | Attack `+80%`, missile HP `+200%`, attack interval `+25%`.                                             | 17:32:40   |

### Steel Ball / Стальной шар

| Technology                  | Cost | Observed effect                                                                                                                                                      | Screenshot |
| --------------------------- | ---: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Поглощение энергии          |  200 | HP `+60%`; damage dealt is converted into HP.                                                                                                                        | 17:35:03   |
| Распределение ущерба        |  250 | Links adjacent Steel Balls, grants `+120%` HP, and distributes damage evenly.                                                                                        | 17:35:10   |
| Увеличение дальности        |  300 | Range `+40`.                                                                                                                                                         | 17:35:16   |
| Механическое разделение     |  300 | On death spawns five level-1 Crawlers.                                                                                                                               | 17:35:26   |
| Усиление брони              |  300 | HP `+35%`; blocks `60` damage plus another `60` per rank.                                                                                                            | 17:35:33   |
| Блокировка укрепленной цели |  200 | When retargeting, prioritizes the reachable unit with the highest current HP.                                                                                        | 17:35:40   |
| Кинетический заряд          |  150 | Displayed Russian tooltip: gains `1 m` of additional movement reserve for every `7 m` travelled, capped at `100 m`; the underlying combat interpretation is unclear. | 17:35:45   |

### Fire Badger / Огневик

| Technology           | Cost | Observed effect                                                                                                        | Screenshot |
| -------------------- | ---: | ---------------------------------------------------------------------------------------------------------------------- | ---------- |
| Увеличение дальности |  300 | Range `+40`.                                                                                                           | 17:36:49   |
| Напалм               |  250 | HP `-30%`; attacks ignite a `12 m` area for `8 s`, dealing `270` damage/s.                                             | 17:36:54   |
| Воспламенение        |  100 | Attacks ignite the target squad for `2 s`; affected units lose `6%` HP/s and cannot heal.                              | 17:37:00   |
| Полевое обслуживание |  150 | HP `+30%`; regenerates `4.5%` max HP/s while taking damage.                                                            | 17:37:14   |
| Испепеляющий огонь   |  300 | Attack `+85%`.                                                                                                         | 17:37:19   |
| Палящий заряд        |  200 | HP `+80%`; below `50%` HP charges an enemy and explodes for remaining HP in a `40 m` radius, also igniting the ground. | 17:37:25   |
| Контрогонь           |  200 | HP `+50%`; taking damage grants `+70` range for `20 s`.                                                                | 17:37:32   |

### Sabertooth / Саблезуб

| Technology           | Cost | Observed effect                                                                                                                                               | Screenshot |
| -------------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Увеличение дальности |  300 | Range `+40`.                                                                                                                                                  | 17:38:09   |
| Полевое обслуживание |  200 | HP `+30%`; regenerates `4.5%` max HP/s while taking damage.                                                                                                   | 17:38:13   |
| Перехватчик ракет    |  100 | Intercepts enemy missiles within `150 m`; cannot stop field abilities, and sustained interception loses efficiency. Effect is independent of attack and rank. | 17:38:19   |
| Двойной выстрел      |  150 | Fires two shots per attack; attack interval `+12%`.                                                                                                           | 17:38:24   |
| Вторичное вооружение |  200 | Adds one side gun on each side: `95 m` range, one shot every `4 s`, `2,000` damage plus `2,000` per rank.                                                     | 17:38:30   |
| Полевой окоп         |  200 | Deploys immobile in a trench: HP `+50%`, range `+20`, attack interval `-20%`; leaves and destroys it after `7 s` without an enemy in range.                   | 17:38:36   |

### Tarantula / Тарантул

| Technology                    | Cost | Observed effect                                                                                                                                           | Screenshot |
| ----------------------------- | ---: | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Паучья мина                   |  150 | Creates two `750`-HP mines every `15 s`; mines chase and explode for `2,500` damage in `12 m`. Each Tarantula rank adds `750` mine HP and `2,500` damage. | 17:43:06   |
| Увеличение дальности          |  300 | Range `+40`.                                                                                                                                              | 17:43:10   |
| Механическая ярость           |  400 | Speed `+4`; attack interval `-0.2 s`.                                                                                                                     | 17:43:14   |
| Бронебойные пули              |  150 | Attack `+50%`.                                                                                                                                            | 17:43:18   |
| Полевое обслуживание          |  150 | HP `+30%`; regenerates `4.5%` max HP/s while taking damage.                                                                                               | 17:43:25   |
| Усиление брони                |  100 | HP `+50%`; blocks `60` damage plus another `60` per rank.                                                                                                 | 17:43:29   |
| Зенитные боеприпасы           |  150 | Can target air units.                                                                                                                                     | 17:43:33   |
| Осколочно-фугасные боеприпасы |  300 | Splash `+7 m`; attack `-45%`.                                                                                                                             | 17:43:38   |

### Rhino / Носорог

| Technology           | Cost | Observed effect                                                                                                   | Screenshot |
| -------------------- | ---: | ----------------------------------------------------------------------------------------------------------------- | ---------- |
| Вихрь                |  150 | When surrounded, performs a slower whirlwind attack dealing `14x` normal attack.                                  | 17:47:01   |
| Фотонное покрытие    |  300 | Takes `30%` less damage for the first `30 s` and is immune to EMP, ignition, acid, and degeneration beam effects. | 17:47:06   |
| Полевое обслуживание |  200 | Regenerates `4.5%` max HP/s while taking damage.                                                                  | 17:47:11   |
| Финальный блиц       |  250 | At `0` HP self-destructs for max-HP damage to all units within `48 m`.                                            | 17:47:17   |
| Механическая ярость  |  100 | Speed `+5`; attack interval `-0.3 s`.                                                                             | 17:47:23   |
| Переработка обломков |  100 | Attack `+60%`; killing an enemy heals for that target's HP.                                                       | 17:47:34   |
| Силовая броня        |  300 | HP `+25%`; gains slow immunity.                                                                                   | 17:47:40   |
| Усиление брони       |  200 | HP `+50%`; blocks `60` damage plus another `60` per rank.                                                         | 17:47:45   |
| Боевое развитие      |  150 | During combat gains `+2.5%` HP and `+4.5%` attack each second.                                                    | 17:47:49   |

### Hacker / Хакер

| Technology              | Cost | Observed effect                                                                                        | Screenshot |
| ----------------------- | ---: | ------------------------------------------------------------------------------------------------------ | ---------- |
| Мультиконтроль          |  250 | Range `-25`; uses five control beams, each at `17%` effectiveness.                                     | 18:14:54   |
| Барьер                  |  400 | Generates an allied shield dome; shield HP increases by `16,000` per Hacker rank.                      | 18:14:59   |
| Увеличение дальности    |  300 | Range `+40`.                                                                                           | 18:15:05   |
| Усиленный контроль      |  300 | Controlled units immediately restore all HP.                                                           | 18:15:10   |
| Электромагнитные помехи |  100 | Hits apply EMP, disabling technologies and reducing movement speed by `40%`; duration was not visible. | 18:15:19   |

### Wasp / Оса

| Technology                    | Cost | Observed effect                                                                                        | Screenshot |
| ----------------------------- | ---: | ------------------------------------------------------------------------------------------------------ | ---------- |
| Энергетический щит            |  300 | Every model gains a shield equal to its HP that blocks at least one hit.                               | 18:16:19   |
| Увеличение дальности          |  300 | Range `+40`.                                                                                           | 18:16:24   |
| Прыжковый двигатель           |  100 | Speed `+5`; may be freely repositioned during every round's deployment phase.                          | 18:16:32   |
| Наземная специализация        |  200 | Attack against ground units `+200%`.                                                                   | 18:16:40   |
| Элитный Снайпер               |  400 | Per rank: range `+5`, attack `+25%`.                                                                   | 18:16:49   |
| Воспламенение                 |  100 | Attacks ignite the target squad for `2 s`; affected units lose `6%` HP/s and cannot heal.              | 18:17:00   |
| Электромагнитный выстрел      |  100 | Hits apply EMP, disabling technologies and reducing movement speed by `40%`; duration was not visible. | 18:17:04   |
| Осколочно-фугасные боеприпасы |  100 | Splash `+7 m`; attack `-30%`.                                                                          | 18:17:10   |
| Бронебойные пули              |  100 | Attack `+50%`.                                                                                         | 18:17:16   |
| Воздушная специализация       |  200 | Against air: attack `+90%`, range `+30`.                                                               | 18:17:22   |

### Phoenix / Феникс

| Technology               | Cost | Observed effect                                                                                                               | Screenshot |
| ------------------------ | ---: | ----------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Квантовая пересборка     |  150 | A destroyed Phoenix cockpit follows the nearest allied Phoenix and fully rebuilds after `12 s`; may activate once per battle. | 18:17:53   |
| Увеличение дальности     |  300 | Range `+40`.                                                                                                                  | 18:18:08   |
| Перегрузка орудий        |  200 | Attack interval `-50%`; range `-25`.                                                                                          | 18:18:14   |
| Энергетический щит       |  200 | Gains a shield equal to unit HP that blocks at least one hit.                                                                 | 18:18:20   |
| Прыжковый двигатель      |  100 | Speed `+5`; may be freely repositioned during every round's deployment phase.                                                 | 18:18:27   |
| Электромагнитный выстрел |  200 | Hits apply EMP, disabling technologies and reducing movement speed by `40%`; duration was not visible.                        | 18:19:58   |
| Элитный Снайпер          |  400 | Per rank: range `+5`, attack `+20%`.                                                                                          | 18:20:03   |
| Заряженный выстрел       |  200 | Attack `+200%`; range `-25`.                                                                                                  | 18:20:10   |

### Phantom Ray / Фантомный луч

| Technology                    | Cost | Observed effect                                                                                               | Screenshot |
| ----------------------------- | ---: | ------------------------------------------------------------------------------------------------------------- | ---------- |
| Режим серийной съемки         |  200 | Fires ten missiles per attack; reload time `+150%`.                                                           | 18:20:57   |
| Увеличение дальности          |  300 | Range `+40`.                                                                                                  | 18:21:02   |
| Усиление брони                |  250 | HP `+35%`; blocks `60` damage plus another `60` per rank.                                                     | 18:21:07   |
| Бомба с липкой нефтью         |  100 | Every `12 s` launches a slowing oil bomb with `180 m` range; the oil can be ignited.                          | 18:21:12   |
| Плащ-невидимка                |  100 | Attack `+20%`, HP `+20%`, starts cloaked; cannot be targeted while cloaked and reveals itself when attacking. | 18:21:18   |
| Осколочно-фугасные боеприпасы |  150 | Splash `+7 m`; attack `-40%`.                                                                                 | 18:21:24   |
| Энергетический щит            |  400 | Gains a shield equal to unit HP that blocks at least one hit.                                                 | 18:21:28   |
| Наземное наведение            |  200 | Range against ground units `+60`.                                                                             | 18:21:34   |

### Wraith / Призрак

| Technology                    | Cost | Observed effect                                                                       | Screenshot |
| ----------------------------- | ---: | ------------------------------------------------------------------------------------- | ---------- |
| Массив парящей артиллерии     |  400 | Increases the number of hovering guns from four to eight.                             | 18:22:06   |
| Увеличение дальности          |  300 | Range `+40`.                                                                          | 18:22:14   |
| Усиление брони                |  200 | HP `+35%`; blocks `60` damage plus another `60` per rank.                             | 18:22:18   |
| Дегенеративный луч            |  200 | Affects enemies within `120 m`: speed `-40%`, attack `-20%`, incoming damage `+30%`.  | 18:22:23   |
| Полевое обслуживание          |  200 | HP `+30%`; regenerates `4.5%` max HP/s while taking damage.                           | 18:22:29   |
| Осколочно-фугасные боеприпасы |  150 | Hovering-gun splash `+7 m`; attack `-30%`.                                            | 18:22:33   |
| Лэнд Крузер                   |  300 | Becomes a ground unit and loses air targeting; range `+50`, attack interval `+0.6 s`. | 18:22:40   |

### Scorpion / Скорпион

| Technology           | Cost | Observed effect                                                                                      | Screenshot |
| -------------------- | ---: | ---------------------------------------------------------------------------------------------------- | ---------- |
| Кислотная атака      |  250 | Creates a `15 m` acid pool for `18 s`; affected units lose `3%` HP/s and take `+250%` attack damage. | 18:33:06   |
| Осадный режим        |  300 | Range `+100`, attack `-40%`, attack interval `+1.5 s`; cannot attack enemies within `75 m`.          | 18:33:11   |
| Увеличение дальности |  300 | Range `+40`.                                                                                         | 18:33:15   |
| Двойной выстрел      |  100 | Fires two shells per attack; reload time `+12%`.                                                     | 18:33:18   |
| Полевое обслуживание |  150 | HP `+30%`; regenerates `4.5%` max HP/s while taking damage.                                          | 18:33:23   |
| Усиление брони       |  100 | HP `+50%`; blocks `60` damage plus another `60` per rank.                                            | 18:33:27   |
| Конвергентный огонь  |  100 | Range `+30`, attack interval `-1 s`, splash `-8 m`.                                                  | 18:33:32   |

### Farseer / Провидец

| Technology              | Cost | Observed effect                                                                                                                                               | Screenshot |
| ----------------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Фотонное излучение      |  400 | Nearby allied ground units within `100 m` take `30%` less damage for the first `20 s` and are immune to EMP, ignition, acid, and degeneration beam effects.   | 18:37:59   |
| Поисковый радар         |  200 | Allied units within `100 m` gain `+10` range; multiple radars do not stack.                                                                                   | 18:38:03   |
| Перехватчик ракет       |  200 | Intercepts enemy missiles within `150 m`; cannot stop field abilities, and sustained interception loses efficiency. Effect is independent of attack and rank. | 18:38:09   |
| Электромагнитный взрыв  |  150 | Hits apply EMP, disabling technologies and reducing movement speed by `40%`; duration was not visible.                                                        | 18:38:12   |
| Увеличение дальности    |  300 | Range `+40`.                                                                                                                                                  | 18:38:18   |
| Режим серийной съемки   |  150 | Fires twelve missiles per attack; reload time `+200%`.                                                                                                        | 18:38:22   |
| Воздушная специализация |  200 | Against air: attack `+90%`, range `+30`.                                                                                                                      | 18:38:26   |

### Typhoon / Тайфун

| Technology                    | Cost | Observed effect                                                                                                                                 | Screenshot     |
| ----------------------------- | ---: | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Увеличение дальности          |  300 | Range `+40`.                                                                                                                                    | 18:38:52       |
| Знак противовоздушной обороны |  300 | Every `10 s` launches a `160 m` marker missile; air enemies within `100 m` of the target lose `20` range and take `30%` more damage for `10 s`. | 18:38:57       |
| Реактивная броня              |  150 | Reduces incoming damage by `80%` up to five times.                                                                                              | 18:39:01       |
| Массив обслуживания           |  200 | Every `3 s` heals Typhoon and allies within `100 m` for `500`, plus `500` per level.                                                            | 18:39:05       |
| Полевое окоп                  |  200 | Deploys immobile in a trench: HP `+70%`, range `+20`; leaves and destroys it after `7 s` without an enemy in range.                             | 18:39:11       |
| Повторная сборка на местах    |  300 | After destruction returns after `5 s` at full HP; limited to one activation per round.                                                          | 18:39:16       |
| Детонация обломков            |  200 | Units killed by Typhoon explode for `115` damage to all units within `12 m`.                                                                    | 08-02 13:04:18 |

### Vulcan / Вулкан

| Technology            | Cost | Observed effect                                                                               | Screenshot |
| --------------------- | ---: | --------------------------------------------------------------------------------------------- | ---------- |
| Воспламенение         |  300 | Attacks ignite the target squad for `2 s`; affected units lose `6%` HP/s and cannot heal.     | 18:40:01   |
| Увеличение дальности  |  300 | Range `+40`.                                                                                  | 18:40:06   |
| Зажигательная бомба   |  250 | Every `16 s` launches an incendiary-bomb volley; maximum range `180 m`, minimum range `40 m`. | 18:40:11   |
| Испепеляющий огонь    |  300 | Attack `+85%`.                                                                                | 18:40:19   |
| Лучший партнер        |  350 | Summons one same-rank Marksman at battle start.                                               | 18:40:29   |
| Бомба с липкой нефтью |  150 | Every `16 s` launches a slowing oil-bomb volley; maximum range `180 m`, minimum range `40 m`. | 18:40:34   |
| Усиление брони        |  150 | HP `+50%`; blocks `60` damage plus another `60` per rank.                                     | 18:40:40   |

### Melting Point / Плавильня

| Technology             | Cost | Observed effect                                                                                                                 | Screenshot |
| ---------------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Поглощение энергии     |  200 | HP `+60%`; damage dealt is converted into HP.                                                                                   | 18:41:05   |
| Увеличение дальности   |  300 | Range `+40`.                                                                                                                    | 18:41:09   |
| Рассеивание энергии    |  150 | Range `-30`; fires five beams, each dealing `17%` of original damage.                                                           | 18:41:13   |
| Электромагнитный шквал |  300 | Every `15 s` fires 16 shots at `180 m`; each deals `6,000` shield damage, slows all units, and disables technologies for `8 s`. | 18:41:17   |
| Производство Ползунов  |  300 | Produces eight Crawlers every `36 s`, up to three activations.                                                                  | 18:41:21   |
| Усиление брони         |  100 | HP `+50%`; blocks `60` damage plus another `60` per rank.                                                                       | 18:41:28   |

### Fortress / Крепость

| Technology           | Cost | Observed effect                                                                                      | Screenshot |
| -------------------- | ---: | ---------------------------------------------------------------------------------------------------- | ---------- |
| Барьер               |  500 | Generates an allied shield dome; shield HP increases by `40,000` per Fortress rank.                  | 18:42:03   |
| Увеличение дальности |  300 | Range `+40`.                                                                                         | 18:42:07   |
| Зенитный шквал       |  200 | Every `10 s` fires 16 anti-air missiles; each deals `900` damage and has `170 m` range.              | 18:42:11   |
| Производство Клыков  |  300 | Produces eight Fangs every `36 s`, up to three activations.                                          | 18:42:23   |
| Перегрузка орудий    |  150 | Attack interval `-50%`; range `-20`.                                                                 | 18:42:28   |
| Элитный Снайпер      |  150 | Per rank: range `+5`, attack `+25%`.                                                                 | 18:42:33   |
| Двойной выстрел      |  100 | Fires two shells per attack; reload time `+12%`.                                                     | 18:42:38   |
| Усиление брони       |  150 | HP `+50%`; blocks `60` damage plus another `60` per rank.                                            | 18:42:43   |
| Ракетный выпад       |  300 | Fires at `85%` and `5%` HP: `180 m` range, `12,000` damage in `25 m`, plus `12,000` damage per rank. | 18:42:48   |
| Твердый снимок       |  200 | Range `+60`, attack interval `+0.7 s`, splash `-2 m`.                                                | 18:42:53   |

### Sandworm / Песчаный червь

| Technology              | Cost | Observed effect                                                                                                                   | Screenshot     |
| ----------------------- | ---: | --------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Механическая ярость     |  150 | Speed `+5`; attack interval `-0.8 s`.                                                                                             | 08-02 13:07:26 |
| Усиление брони          |  250 | HP `+50%`; blocks `60` damage plus another `60` per rank.                                                                         | 08-02 13:07:36 |
| Механическое разделение |  200 | On destruction, four same-rank Larvae spawn and continue the battle.                                                              | 08-02 13:07:45 |
| ПВО                     |  100 | Range `+20`; enables attacks against air targets.                                                                                 | 08-02 13:07:53 |
| Подземное обслуживание  |  150 | HP `+20%`; restores `20%` max HP per second while underground.                                                                    | 08-02 13:08:03 |
| Репликация              |  250 | Each emergence creates one same-rank Larva that continues the battle.                                                             | 08-02 13:08:12 |
| Песчаная буря           |  200 | On emergence creates a `120 m` sandstorm for `7 s`; units inside lose `50%` range and take `30%` less damage from ranged attacks. | 08-02 13:08:20 |
| Удар                    |  100 | Emerges faster; the first attack after emerging gains `+30%` attack and `+10 m` splash.                                           | 08-02 13:08:28 |

### Raiden / Райден

| Technology               | Cost | Observed effect                                                                                     | Screenshot     |
| ------------------------ | ---: | --------------------------------------------------------------------------------------------------- | -------------- |
| Вилка                    |  250 | Range `-10`; increases lightning bolts per attack from three to five.                               | 08-02 13:09:07 |
| Цепочка                  |  200 | Range `-20`; lightning jumps after impact to enemies within `60 m`, dealing `25%` damage.           | 08-02 13:09:15 |
| Ионизация                |  100 | Attack `-70%`; attacks deal additional damage equal to `50%` of the target's current HP.            | 08-02 13:09:24 |
| Увеличение дальности     |  300 | Range `+40`.                                                                                        | 08-02 13:09:32 |
| Электромагнитный выстрел |  300 | Hits temporarily disable technologies and reduce movement speed by `40%`; duration was not visible. | 08-02 13:09:41 |
| Энергетический щит       |  150 | Gains a shield equal to max HP that blocks at least one hit.                                        | 08-02 13:09:49 |

### Overlord / Владыка

| Technology                    | Cost | Observed effect                                                                                                                               | Screenshot     |
| ----------------------------- | ---: | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Артиллерия Владыки            |  300 | Adds two ground-only guns with `140 m` range; each fires every `3 s` for `7,000` damage, plus `7,000` per Overlord rank.                      | 08-02 13:10:39 |
| Перегрузка орудий             |  300 | Attack interval `-50%`; range `-20`.                                                                                                          | 08-02 13:10:48 |
| Материнский корабль           |  250 | Produces five Wasps every `32 s`, up to three activations.                                                                                    | 08-02 13:10:56 |
| Прыжковый двигатель           |  300 | Speed `+5`; allows free redeployment during the deployment phase of every round.                                                              | 08-02 13:11:06 |
| Фотонное излучение            |  300 | Other allies within `100 m` take `30%` less damage for the first `20 s` and are immune to EMP, ignition, acid, and degeneration beam effects. | 08-02 13:11:14 |
| Увеличение дальности          |  300 | Range `+40`.                                                                                                                                  | 08-02 13:11:23 |
| Усиление брони                |  150 | HP `+35%`; blocks `60` damage plus another `60` per rank.                                                                                     | 08-02 13:11:33 |
| Полевое обслуживание          |  150 | HP `+30%`; regenerates `4.5%` max HP/s while taking damage.                                                                                   | 08-02 13:11:40 |
| Осколочно-фугасные боеприпасы |  200 | Splash `+7 m`; attack `-40%`.                                                                                                                 | 08-02 13:11:48 |

### War Factory / Военный завод

| Technology                    | Cost | Observed effect                                                                                                                                               | Screenshot     |
| ----------------------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Увеличение дальности          |  500 | Range `+40`.                                                                                                                                                  | 08-02 13:12:35 |
| Производство Фениксов         |  500 | Produces one Phoenix every `17.2 s`, up to six activations.                                                                                                   | 08-02 13:12:44 |
| Производство Стальных шаров   |  450 | Produces one Steel Ball every `9.7 s`, up to ten activations.                                                                                                 | 08-02 13:12:52 |
| Производство Кувалд           |  400 | Produces one Sledgehammer every `6.6 s`, up to fourteen activations.                                                                                          | 08-02 13:13:02 |
| Перехватчик ракет             |  350 | Intercepts enemy missiles within `150 m`; cannot stop field abilities, and sustained interception loses efficiency. Effect is independent of attack and rank. | 08-02 13:13:09 |
| Перегрузка орудий             |  300 | Attack interval `-50%`; range `-20`.                                                                                                                          | 08-02 13:13:19 |
| Фотонное покрытие             |  200 | Takes `30%` less damage for the first `30 s` and is immune to EMP, ignition, acid, and degeneration beam effects.                                             | 08-02 13:13:28 |
| Усиление брони                |  350 | HP `+50%`; blocks `60` damage plus another `60` per rank.                                                                                                     | 08-02 13:13:35 |
| Осколочно-фугасные боеприпасы |  350 | Main-gun splash `+7 m`; attack `-40%`.                                                                                                                        | 08-02 13:13:43 |

### Abyss / Бездна

| Technology             | Cost | Observed effect                                                                                                              | Screenshot     |
| ---------------------- | ---: | ---------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Увеличение дальности   |  500 | Range `+40`.                                                                                                                 | 08-02 13:14:57 |
| Темный компаньон       |  300 | Summons one same-rank Wraith at battle start.                                                                                | 08-02 13:15:05 |
| Фотонное покрытие      |  250 | Takes `30%` less damage for the first `30 s` and is immune to EMP, ignition, acid, and degeneration beam effects.            | 08-02 13:15:14 |
| Дезинтеграция          |  350 | Every `15 s`, enemy ground units within `250 m` lose `20%` current HP and suffer `-40%` movement speed for `5 s`.            | 08-02 13:15:22 |
| Ракеты Swarm           |  500 | Every `15 s` fires 46 missiles at the nearest ground enemies; each deals `400` damage at `200 m`, plus `400` per Abyss rank. | 08-02 13:15:31 |
| Переработка обломков   |  200 | Attack `+35%`; killing an enemy restores HP equal to that enemy's HP.                                                        | 08-02 13:15:40 |
| Вертикальная развертка |  350 | Attack `+50%`; changes the laser sweep to vertical movement.                                                                 | 08-02 13:15:48 |

### Mountain / Гора

| Technology                       | Cost | Observed effect                                                                                                            | Screenshot       |
| -------------------------------- | ---: | -------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Ракета, запущенная с применением |  400 | Every `14 s` fires a missile at `180 m` for `22,500` damage within `15 m`, plus `22,500` damage per Mountain rank.         | 08-02 13:16:28   |
| Горное покрытие                  |  400 | Blocks `700` damage plus another `700` per rank.                                                                           | 08-02 13:16:36   |
| Бомбардировка насыщением         |  500 | Splash `+3 m`; fires 16 widely scattered shells per attack; attack interval `+120%`.                                       | 08-02 13:16:43   |
| Боепатроны повышенной дальности  |  400 | Range `+160`; attack `-75%`.                                                                                               | 08-02 13:16:49   |
| Дымовая бомба                    |  350 | Every `25 s` fires eight smoke grenades between `60-180 m`; units in smoke lose `35%` range.                               | 08-02 13:16:56   |
| Фотонная петля                   |  400 | Every `30 s`, takes `30%` less damage for `25 s` and becomes immune to EMP, ignition, acid, and degeneration beam effects. | 08-02 13:17:05   |
| Зенитные боеприпасы              |  300 | Attack `-40%`; enables attacks against air targets.                                                                        | 08-02 attachment |

## Notable technology contracts

| Technology pattern             | Observed implementation                                                                                            | Design value for Mars2050                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Range extension                | Usually `+40` range on the base weapon.                                                                            | Changes formation depth and first-contact timing without adding a new unit.                           |
| Mechanical Rage                | More movement speed and shorter attack interval.                                                                   | Converts a line unit into tempo pressure; should compete with defensive doctrines.                    |
| Field Maintenance              | Usually `+30%` HP and `4.5%` max-HP regeneration per second while taking damage.                                   | Creates a sustained tank but still loses to burst and anti-heal.                                      |
| Armor Enhancement              | More HP plus rank-scaled flat damage block.                                                                        | Strong against rapid small hits, weak against slow heavy attacks.                                     |
| Armor-piercing option          | Large attack increase or anti-heavy targeting, sometimes with slower cadence.                                      | Creates a specialist counter while exposing the unit to screens and overkill.                         |
| High-explosive option          | Larger splash with a substantial attack penalty.                                                                   | A clean anti-swarm doctrine with an explicit single-target downside.                                  |
| EMP option                     | Applies technology shutdown and movement reduction.                                                                | Adds control without requiring a separate controller in every tier.                                   |
| Anti-air conversion            | Adds air targeting or increases damage and range against air.                                                      | Lets anti-air emerge from selected squads instead of bloating the base roster.                        |
| Link / damage sharing          | Nearby identical units share damage or gain attack from the formation.                                             | Makes basic placement meaningful even without a strategic campaign layer.                             |
| Spawn / death payload          | Replication, decoys, mines, spawned Fangs or Crawlers, and death explosions.                                       | Produces visible role changes, but needs caps and clear replay signals.                               |
| Engagement-envelope conversion | Assault Mode, Weapon Overload, Air Mode, or Field Trench changes range or mobility.                                | Strongest form of upgrade because it changes where and how the unit fights.                           |
| Conditional power              | Bonuses after travel, below an HP threshold, after attacks, on kill, or over battle time.                          | Creates readable timing windows and counterplay instead of permanent stat inflation.                  |
| Multi-target control           | Hacker loses `25` range and splits control across five beams at roughly `17%` effectiveness each.                  | A wider control branch must lose capture speed or reach so it cannot dominate every target profile.   |
| Layer conversion               | Wraith's Land Cruiser loses air targeting, gains `50` range, and adds `0.6 s` to its attack interval.              | Moving between air and ground should change both counters and the engagement envelope.                |
| Siege conversion               | Scorpion gains `100` range but loses `40%` attack, fires `1.5 s` slower, and gains a `75` minimum range.           | Long-range transformation needs a real dead zone and lower close-combat efficiency.                   |
| Opening protection window      | Farseer's Photon Emission gives nearby ground allies `30%` damage reduction for 20 seconds and status immunities.  | Timed protection can shape deployment without becoming a permanent stat aura.                         |
| Sustained target lock          | Steel Ball and Melting Point ramp damage while remaining on one target.                                            | Anti-heavy damage can be strong without burst if screens and displacement reset its payoff.           |
| Percentage-current-HP damage   | Raiden trades `70%` attack for `50%` current-HP bonus damage; Abyss applies `20%` current-HP damage every `15 s`.  | Scaling anti-titan effects need a cadence or base-damage cost so they do not become universal damage. |
| Production doctrine            | Overlord and War Factory create capped batches of Wasps, Phoenixes, Steel Balls, or Sledgehammers on fixed timers. | A production chassis can change army composition during combat, but every stream needs visible caps.  |
| Local range suppression        | Sandstorm cuts range by `50%`; smoke cuts it by `35%`, while both are limited by area and duration.                | Terrain-like status zones can disrupt back lines without globally disabling ranged units.             |
| Rank-scaled auxiliary weapon   | Overlord artillery, Mountain's missile, and Abyss missiles add a fixed damage amount for each unit rank.           | Auxiliary weapons can remain relevant across ranks without multiplying every part of their payload.   |

## Direct Mars2050 conclusions

| Mechabellum evidence                                                                                                             | Mars2050 decision                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Aura support appears as a Vortex technology rather than requiring a separate baseline support body.                              | Remove Officer from the baseline Tier 1 roster; distribute command auras through squad upgrades.                                 |
| Sabertooth becomes a stationary anchor through Field Trench.                                                                     | Do not add a separate Tier 1 Bastioner yet; let an existing squad take an anchor doctrine.                                       |
| Tarantula receives mines as a branch while remaining a combat unit.                                                              | Replace the generic Sapper with demolition anti-heavy drones; move mine laying to a later drone or buggy upgrade.                |
| Steel Ball uses speed, high-HP target lock, and contact ramp to reach heavy targets.                                             | Demolition drones need explicit heavy-target preference and screening counterplay.                                               |
| Rhino and Steel Ball solve different melee jobs.                                                                                 | Keep Shock Troopers as frontline engagement; demolition drones as anti-heavy contact; Buggy as ranged flanker.                   |
| Fire Badger and Stormcaller both deal area damage but have opposite engagement envelopes.                                        | Keep Flamethrower and Grenadier separate: sustained close cone versus intermittent mid-range burst.                              |
| Mustang can specialize into anti-air, interception, armor piercing, or splash.                                                   | Heavy Gunner should remain soft anti-air at baseline and choose one stronger doctrine later.                                     |
| Transformative technologies commonly include a real downside.                                                                    | Use one mutually exclusive doctrine per squad plus no more than two minor modules.                                               |
| Wasp, Phoenix, Phantom Ray, and Wraith share the air layer but differ sharply in model count, range, cadence, and splash.        | Build air roles around distinct target profiles; do not make every flying unit a universal damage dealer.                        |
| Typhoon and Vulcan both clear light units at different costs and scales.                                                         | A Tier 1 Heavy Gunner may cover soft anti-air and light suppression; giant ground area denial belongs to a later tier.           |
| Hacker concentrates strong control in one fragile body and has capture downtime.                                                 | Keep hard capture or conversion outside Tier 1; early control should use marks, suppression, displacement, or short disables.    |
| Scorpion can trade raw burst for siege range and a dead zone.                                                                    | Let a later artillery squad switch between precision and siege doctrines instead of adding two nearly identical chassis.         |
| Farseer remains a credible combat chassis while carrying protection and interception.                                            | Later support units should contribute visible attacks and expose meaningful positioning risk, not function as passive officers.  |
| Melting Point counters giants through a ramping lock, while Fortress is a giant anchor that can buy screening and support tools. | Make giant counters reciprocal: they need time on target and should lose efficiency when cheap screens break their lock.         |
| Sandworm reaches melee through protected underground travel but concentrates its payoff into repeated emergence windows.         | A later melee giant should have reliable entry without permanent safety; surfacing must create a readable focus-fire window.     |
| War Factory chooses between three capped production lines instead of producing a universal mix.                                  | Summoning platforms should commit to one reinforcement profile, expose its cadence, and enforce both per-wave and lifetime caps. |
| Raiden and Abyss gain anti-giant percentage damage only through major attack loss or a long periodic cooldown.                   | Percentage damage should remain an explicit counter doctrine with a visible opportunity cost, never a baseline property.         |
| Mountain gains `160` range only by losing `75%` attack, while saturation fire adds `120%` to its interval.                       | Extreme artillery reach and wide-area saturation should be mutually costly transformations rather than free stat upgrades.       |
