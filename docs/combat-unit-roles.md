# Combat Unit Roles

This document records the intended battlefield role of every current combat unit.
It is a balancing guide, not a request to add a rigid `role` field to unit stats.
Runtime behavior should continue to use `combatTags`, `targetingProfile`, upgrades,
and explicit mechanics.

## Role Model

Mars2050 should avoid one fixed role per unit. A unit can have a baseline function
and then shift through upgrades. The practical role language for balancing should
describe battlefield jobs, not rigid RPG classes:

| Role | Purpose |
| --- | --- |
| Damage Tank | Absorbs focus through HP, armor, regen, or damage sharing; may not protect allies directly. |
| Guard / Protector | Protects nearby allies through body-blocking, barriers, shields, intercepts, or defensive auras. |
| Fortress Anchor | Slow, static, or XL unit that defines the battle line and demands specialist counterplay. |
| Screen | Cheap bodies or decoys that distract stronger enemies and waste target locks. |
| Screen Clear | AoE, multi-target, or rapid attacks that remove many light units. |
| Carry | Main damage investment unit that scales with upgrades and army support. |
| Specialist Counter | Narrow answer to a specific threat: heavy, shield, summon, stealth, or air. |
| Anti-air | Dedicated specialist counter for flying units. |
| Anti-heavy / Anti-giant | Kills armored, XL, high-HP, or high-value single targets efficiently. |
| Range Pressure | Long-range artillery/sniper pressure that forces enemy positioning answers. |
| Tempo Pressure | Fast or forward-deployed unit that forces immediate enemy response. |
| Assassin | Deletes one high-value or low-HP target through burst, execute, or lock-on damage. |
| Flanker | Wins through angle, speed, air pathing, stealth, or non-frontline access. |
| Backline Killer | Reaches fragile carries, healers, summoners, artillery, or support units. |
| Utility Support | Heals, repairs, shields, buffs, reveals, intercepts missiles, or extends range. |
| Projectile Defense | Intercepts or mitigates missiles, artillery shells, or other long-range projectiles. |
| Area Denial | Creates persistent danger zones through mines, fire, acid, smoke, or hazards. |
| Formation Disruptor | Breaks formations through pull, push, knockback, clumping, or displacement. |
| Disable Control | Temporarily shuts down attacks, abilities, upgrades, shields, or targeting. |
| Hack Control | Converts, steals, confuses, or redirects enemy units. |
| Movement Control | Slows, freezes, roots, or otherwise changes enemy movement speed. |
| Vision / Range Suppression | Reduces range, accuracy, visibility, or target acquisition through smoke/sandstorm effects. |
| Vulnerability Debuff | Makes enemies take more damage, lose armor, or suffer reduced output. |
| Summoner / Decoy | Produces temporary units, screens, or false targets during battle. |
| Tech Carrier | A unit whose battlefield function changes meaningfully through upgrades. |

## Mechabellum Alignment

Use Mechabellum as a role vocabulary reference, but avoid importing slang into
public-facing config names. In Mars2050:

| Mechabellum term | Mars2050 term |
| --- | --- |
| chaff | Screen |
| chaff clear | Screen Clear |
| carry / DPS investment | Carry |
| tank | Damage Tank |
| guard / barrier protector | Guard / Protector |
| fortress / static titan | Fortress Anchor |
| anti-giant | Anti-heavy / Anti-giant |
| artillery / sniper pressure | Range Pressure |
| fast forced-answer unit | Tempo Pressure |
| assassin / execute unit | Assassin |
| flanker / angle attacker | Flanker |
| backline killer | Backline Killer |
| tech card / specialist answer | Specialist Counter |
| support aura / radar | Utility Support |
| missile interceptor | Projectile Defense |
| fire, acid, smoke, mines | Area Denial |
| pull, knockback, clumping | Formation Disruptor |
| EMP / upgrade shutdown | Disable Control |
| hacker control beam | Hack Control |
| slow / freeze / sticky oil | Movement Control |
| smoke / sandstorm / range reduction | Vision / Range Suppression |
| degeneration / armor break | Vulnerability Debuff |
| production tech | Summoner / Decoy |

The most important Mechabellum lesson is that upgrades should transform roles.
For example, a baseline carry can become emergency anti-air, a guard can become
projectile defense, or an anti-giant beam can become anti-medium through split
fire. This document tracks intended functions; runtime should still use
`combatTags`, `targetingProfile`, upgrades, and explicit mechanics.

## Status / State Model

Mechabellum-style control is not one generic status. Mars2050 should separate
short-lived combat statuses from special mechanics such as shields, stealth,
revive, projectile interception, and forced movement.

Current runtime status support is minimal: `emp`, `burn`, and `slow`. The
simulation also has adjacent state fields such as `shield`, `stealthUntilAttack`,
`lifestealMult`, `damageReductionWhileMoving`, `onDeathPuddle`, and hazards.

### Core statuses to add first

| Status | Role category | Intended behavior | Primary users |
| --- | --- | --- | --- |
| `emp` | Disable Control | Temporarily disables attacks, upgrades, shields, or targeting hooks. | `emp_drone`, `railgun_walker`, global EMP |
| `slow` | Movement Control | Multiplies movement speed for a fixed duration. | `cryo_tank`, `gravity_manipulator`, mines |
| `burn` | Area Denial | Deals damage over time and can be applied by fire hazards. | `flamethrower`, napalm, incendiary upgrades |
| `acid` | Area Denial / Vulnerability Debuff | Deals DoT or weakens armor/giants in a zone. | `alien_bug`, `alien_spitter`, anti-giant upgrades |
| `vulnerable` | Vulnerability Debuff | Increases incoming damage or reduces armor/defense. | `ion_crawler`, `emp_drone`, `nanite_generator` |
| `range_suppressed` | Vision / Range Suppression | Reduces range, accuracy, or target acquisition. | `radar_zepplin`, `sonic_devastator`, smoke units |
| `revealed` | Anti-stealth / Utility Support | Allows targeting stealth units and cancels hidden bonuses. | `radar_zepplin`, `scout_drone`, `officer` |
| `hacked` | Hack Control | Temporarily converts, confuses, or redirects a target. | `hacker_rover` |
| `damage_reduction` | Guard / Protector | Reduces incoming damage for a duration. | `shield_emitter`, `officer`, photon-like upgrades |
| `regen` | Utility Support | Restores HP over time. | `engineer`, `nanite_generator`, repair upgrades |

### Advanced / optional statuses

| Status | Role category | Intended behavior | Primary users |
| --- | --- | --- | --- |
| `output_suppressed` | Disable Control | Reduces attack speed, damage, or ability cadence without fully disabling the unit. | suppression rounds, sonic weapons, smoke/sandstorm effects |
| `armor_broken` | Vulnerability Debuff | Reduces flat armor, damage block, or mitigation separately from generic damage vulnerability. | acid weapons, ion weapons, armor-piercing upgrades |
| `degeneration` | Vulnerability Debuff / Anti-giant | Drains HP, blocks regeneration, or applies percent-style decay over time. | ion weapons, anti-giant beams, late-game debuff units |
| `haste` | Tempo Pressure / Carry | Temporarily increases movement, attack cadence, or reload speed. | rage upgrades, charge upgrades, officer buffs |

### Mechanics that should not be plain statuses

| Mechanic | Reason |
| --- | --- |
| Shield HP | Needs numeric absorb, break logging, and shield-specific counters. |
| Stealth | Requires acquisition rules, reveal counters, and first-attack behavior. |
| Lifesteal | Depends on actual damage dealt, not a passive tick. |
| Revive / reassembly | Needs death interception and delayed respawn logic. |
| Pull / knockback | Should be a forced movement event with collision and pathing rules. |
| Projectile interception | Needs projectile or attack-event filtering, not per-unit ticking. |

### Implementation priority

1. Normalize `StatusEffect` into a typed status contract with `type`, `duration`,
   optional `value`, optional `sourceUnitId`, and deterministic stacking rules.
2. Implement P0 statuses: `emp`, `slow`, `burn`, `acid`, `vulnerable`.
3. Add P1 control statuses: `range_suppressed`, `revealed`, `hacked`.
4. Add support statuses: `damage_reduction`, `regen`.
5. Keep shield, stealth, lifesteal, revive, pull/knockback, and projectile
   interception as explicit mechanics with their own tests.

## Advanced Mechanics / Upgrade Primitives

Several Mechabellum effects are not ordinary statuses. Treat them as reusable
upgrade primitives: small deterministic mechanics that can be attached to units,
upgrades, auras, or hazards without hardcoding one-off behavior.

| Primitive | Mechabellum reference | Mars2050 use |
| --- | --- | --- |
| Cleanse / Extinguish | Fire Extinguisher removes fire, acid, smoke. | `engineer`, `nanite_generator`, support upgrades. |
| Status Immunity | Photon Coating/Emission protects from EMP, fire, acid, degeneration. | Guard auras, elite shields, late-game counters to control spam. |
| Flat Damage Block | Armor Enhancement, Mountain Plating. | Heavy armor that counters rapid light attacks but not anti-heavy weapons. |
| Damage Sharing | Sledgehammer and Steel Ball group mitigation. | Guard formations, exosuit/phalanx upgrades, anti-burst tools. |
| Reactive Armor / Invulnerability Charges | Emergency Armor, Reactive Armor, Photon Loop. | Limited charges or timed windows that stop burst without permanent tankiness. |
| Burrow / Underground | Subterranean Blitz, Sandworm burrow. | Movement-state defense for melee screens or underground alien units. |
| Stance / Mode Transform | Assault Mode, Aerial Mode, Land Cruiser, Siege Mode, Field Entrenchment. | Role swaps that change movement, targeting, range, and counters. |
| Target Mark / Priority Override | Fortified Target Lock, Air Defense Mark. | Temporary target tags for anti-air, anti-heavy, execute, or focus-fire roles. |
| Ramp / Charge Scaling | Melting Point beam, Combat Evolvement, Kinetic Charge, Chamber Compression. | Anti-giant beams, late-fight carries, movement-based burst. |
| Multi-weapon / Split Fire / Chain | Fork, Chain, Energy Diffraction, independent Wraith/War Factory guns. | True multi-target weapons beyond simple `multishot`. |
| On-death Effects | Acidic Explosion, Final Blitz, Mechanical Division, Wreckage Detonation. | Death puddles, death explosions, decoy/screen spawns, chain reactions. |
| On-kill Effects | Wreckage Recycling, Replicate. | Lifesteal-on-kill, summon-on-kill, snowball units with caps. |
| Percent HP Damage | Disintegration, Ionization. | Anti-giant tools that scale without deleting medium units too quickly. |
| Projectile / Attack Event Generation | Gun-launched Missile, Swarm Missiles, Anti-Air Barrage. | Periodic missile volleys, anti-air bursts, artillery side weapons. |
| Attack Geometry | Beam, cone, line, splash, pierce, and barrage-style attacks. | Weapon shapes that change positioning value beyond raw AoE radius. |
| Armor Pierce / Shield Bypass | Armor-piercing and shield-breaking tech families. | Specialist counters that ignore part of mitigation without becoming universal DPS. |
| Temporary Battlefield Objects | Barrier, mines, field entrenchment, wreckage, decoys. | Short-lived map objects with HP, collision, targeting, or hazard behavior. |
| Stat Buff / Debuff Windows | Mechanical Rage, Suppression Shots, combat evolvement effects. | Timed or conditional output changes that are not full control effects. |

### Primitive implementation order

1. Defensive primitives: flat damage block, damage sharing, status immunity,
   reactive armor charges.
2. Role-transform primitives: stance/mode transform, target marks, burrow.
3. Scaling primitives: ramp damage, charge scaling, percent HP damage.
4. Weapon primitives: split fire, chain attacks, periodic side weapons.
5. Death/kill primitives: on-death explosions/spawns and on-kill recycling.
6. Attack-shape primitives: beam, cone, line pierce, barrage, and temporary
   battlefield objects.

## Global Findings

1. Tier 1 infantry is too compressed. `marine`, `heavy_gunner`, and `sniper` all
   compete as ranged carry/AA, while `shock_trooper` is a very efficient melee
   screen-pressure baseline.
2. Dedicated anti-air is diluted. Too many general units can target air, which
   reduces the value of `aa_turret`, `missile_buggy`, `gatling_rover`, and
   `interceptor`.
3. Several high-concept units are currently placeholders: their config names imply
   mechanics that do not exist in `actionSystem`.
4. Utility support units need sharper separation. `medic`, `officer`,
   `engineer`, and `nanite_generator` should not all be generic healers.
5. Heavy units are broadly readable, but they need stronger counterplay from EMP,
   armor-piercing, swarm pressure, and shield-breaking.
6. Several units should be documented as Tech Carriers: their upgrades should
   change battlefield function, not only increase stats.

## Status Legend

| Status | Meaning |
| --- | --- |
| Ready | Role is understandable and mostly represented in current mechanics. |
| Tune | Works, but numbers/profile likely need balancing. |
| Needs mechanic | Name/role promises behavior that is not implemented yet. |
| Legacy | Old/static/PvE-only unit that should not drive PvP balance. |

## Current Roster Review

| Unit | Intended role | Current facts | Status | Notes |
| --- | --- | --- | --- | --- |
| `wall` | Static fortress anchor/structure | 500 HP, 0 speed, armored heavy structure | Ready | Good defensive obstacle. Needs economy/building context more than combat changes. |
| `turret` | Static local defense | 200 HP, 240 range, can target air | Tune | General defense overlaps with AA turret. Consider lower AA efficiency. |
| `aa_turret` | Static anti-air specialist | 150 HP, 280 range, `anti_air` profile | Ready | Keep as dedicated air counter. |
| `drone` | Legacy light air screen | Deprecated name, 3-unit flying squad, short range | Legacy | Do not balance around this if `scout_drone` replaces it. |
| `rocketeer` | Legacy screen clear | Deprecated, AoE, can target air | Legacy | Avoid using as modern roster baseline. |
| `alien_bug` | PvE screen | 10-unit melee squad, fast, low HP | Ready | Good swarm test target. |
| `alien_spitter` | PvE screen clear/range pressure | 3-unit ranged AoE squad | Ready | Works as ranged alien pressure. |
| `alien_worm` | PvE damage tank/disruptor | Heavy AoE melee, low DPS | Tune | Needs either more durability or a formation disruption identity. |
| `marine` | Baseline carry | 8 units, 280 total HP, high DPS, can AA | Tune | Too universal. Consider removing native AA or lowering DPS. |
| `shock_trooper` | Tempo pressure/screen | 8 units, 360 total HP, very high DPS | Tune | Too efficient for baseline melee. Needs clearer weakness to AoE/ranged. |
| `flamethrower` | Short-range screen clear | 4 units, low range AoE | Ready | Good identity. Later add burn/status version. |
| `scout_drone` | Fast air screen/scout | 5 units, high speed, can AA | Tune | Strong generalist flyer. Needs fragility or scouting utility. |
| `medic` | Organic utility support | 3 units, heal attack, short support range | Ready | Good early support. Should not be a damage unit. |
| `sniper` | Precision range pressure/assassin | 2 units, 280 range, `assassin`, can AA | Tune | Good role, but AA may dilute anti-air specialists. |
| `scavenger_buggy` | Tempo pressure/flanker | 3 vehicles, very fast, short range | Tune | Needs raider/cleanup identity: low-HP bonus, flank, or resource/pillage theme. |
| `grenadier` | Mid-range screen clear | 4 units, AoE, explosive tag | Ready | Solid anti-clump role. Can gain AA through upgrade only. |
| `heavy_gunner` | Sustained carry/suppression | 6 units, 200 range, high DPS, can AA | Tune | Overlaps marine/gatling. Should become suppression or screen clear specialist. |
| `sapper` | Demolition assassin | 3 units, high AoE burst, low HP | Ready | Good high-risk unit. Ensure it does not overperform with melee slots. |
| `officer` | Command utility support | Currently `attackType: heal` | Needs mechanic | Should become buff/targeting aura, not another healer. |
| `jetpack_trooper` | Flying flanker/backline killer | 5 flying units, fast melee | Tune | Interesting, but needs clear counter and role versus scout drones. |
| `exosuit` | Medium damage tank/bruiser | 4 units, armored heavy, low range | Ready | Good bridge between infantry and vehicles. |
| `gatling_rover` | Anti-air/screen clear specialist | 2 vehicles, rapid fire, `anti_air` | Ready | Good dedicated AA. Could also counter light screens. |
| `plasma_tank` | Anti-heavy specialist | 2 vehicles, `anti_armor`, medium range | Ready | Clear role. Needs armor-piercing tuning once DR exists. |
| `missile_buggy` | Mobile anti-air specialist | 3 vehicles, long range, `anti_air` | Ready | Clear, should be weaker into ground general targets. |
| `gunship` | Air-to-ground carry | 2 flying armored units, ground-only | Ready | Good air pressure. Needs dedicated AA counters to matter. |
| `engineer` | Mechanical utility support | Currently healer with weak attack | Needs mechanic | Should repair mechanical/shields, not heal organic equally. |
| `emp_drone` | Flying disable control specialist | Attack 0, support hunter, no EMP flag in base config | Needs mechanic | Critical fix. Should apply EMP or disable, not chip for 1 damage. |
| `minelayer_rover` | Area denial/movement control | Currently normal attack vehicle | Needs mechanic | Needs mine placement, delayed trigger, or hazard generation. |
| `siege_tank` | Range pressure/screen clear | 320 range, AoE, `siege` profile | Ready | Strong identity. Watch target acquisition and overkill. |
| `railgun_walker` | Range pressure/anti-heavy | 280 range, `long_range_priority` | Ready | Good heavy hunter. Disable-control rounds upgrade fits well. |
| `drone_carrier` | Air summoner/screen producer | Flying, `spawn`, summons scout drones | Tune | Good concept. Validate spawn cadence and target behavior. |
| `cryo_tank` | Movement control/screen clear | Currently AoE damage only | Needs mechanic | Should apply slow/freeze or DR debuff. |
| `shield_emitter` | Guard/projectile defense | Currently no aura/shield action | Needs mechanic | Must grant shields/DR aura or intercept projectiles. |
| `interceptor` | Air superiority specialist | Flying, can AA, `anti_air` | Ready | Clear anti-air flyer. Should be mediocre vs ground. |
| `hacker_rover` | Hack control/specialist counter | Attack 0, support hunter, no hack mechanic | Needs mechanic | Should disable shields/summoners/targeting or convert temporarily. |
| `artillery_crawler` | Extreme range pressure | 400 range, massive AoE hit, slow cooldown | Ready | Clear late-game artillery. Needs minimum range or vulnerability. |
| `titan_mech` | XL damage tank/carry | 800 HP, AoE, can AA, anti-armor | Tune | Too many strengths. Needs explicit weakness: EMP, screen pressure, slow turn. |
| `behemoth_tank` | XL damage tank | 1200 HP, single target, default profile | Ready | Good pure tank. Needs threat low enough to be ignorable or body-blocking value. |
| `ion_crawler` | Anti-giant carry | 600 HP, rapid low attack, anti-armor | Tune | Needs ramping/beam identity; otherwise it is just another heavy DPS unit. |
| `goliath_gunship` | XL air fortress anchor/AA carry | 1000 HP, can AA, anti-air profile | Tune | Very strong profile. Needs hard counters from AA/EMP. |
| `mobile_factory` | Summoner/fortress anchor | 900 HP, spawns exosuits | Tune | Good boss unit. Validate snowball and spawn cap. |
| `sonic_devastator` | XL formation disruptor/screen clear | Currently AoE damage only | Needs mechanic | Should apply knockback/stun/disruption, not plain AoE. |
| `radar_zepplin` | Utility support/reveal | No attack, no reveal/targeting buff | Needs mechanic | Should provide true sight, range, anti-stealth, or targeting relay. |
| `stealth_operative` | Stealth assassin/backline killer | Stealth tag/profile, high single damage | Tune | Needs full stealth/reveal contract with radar/hunter counters. |
| `hologram_projector` | Decoy summoner | Spawns exosuits currently | Needs mechanic | Should spawn low-HP decoys, not real exosuits unless intentional. |
| `gravity_manipulator` | Formation disruptor/guard | Very low DPS AoE, no gravity effect | Needs mechanic | Should pull, slow, clump, or disrupt formations. |
| `nanite_generator` | AoE utility support | Currently generic heal vehicle | Needs mechanic | Should be regen aura or mechanical repair specialist. |
| `bounty_hunter` | Assassin/anti-heavy | Long range, can AA, assassin profile | Tune | Clear role, but may overlap sniper/stealth operative. Needs unique execute/mark mechanic. |

## Priority Fix List

### P0: Broken or misleading units

These units promise a mechanic that the simulation does not currently provide:

1. `emp_drone` - add base EMP application or a dedicated disable-control attack.
2. `shield_emitter` - add shield aura or periodic shield grant.
3. `hacker_rover` - add hack-control or temporary conversion behavior.
4. `cryo_tank` - add movement-control slow/freeze.
5. `gravity_manipulator` - add pull/clump formation disruption or movement control.
6. `radar_zepplin` - add reveal/targeting relay.
7. `minelayer_rover` - add mine/hazard placement.
8. `sonic_devastator` - add knockback/stun formation disruption or disable control.
9. `hologram_projector` - spawn decoys, not normal combat units.
10. `officer` - replace generic heal with command aura/buff.

### P0.5: Status contract

Before adding more control units, normalize status behavior:

1. Expand `StatusEffect.type` from `emp | burn | slow` to the core list in
   Status / State Model.
2. Define deterministic stacking: refresh duration for same `sourceUnitId`, keep
   strongest `value`, and avoid unbounded duplicate stacks.
3. Emit replay actions for `status_apply`, `status_tick` when visible damage or
   healing happens, and `status_expire`.
4. Add balance tests for duration, stacking, shield interaction, stealth reveal,
   and replay determinism.

### P1: Anti-air cleanup

Target state:

| Unit class | Air targeting policy |
| --- | --- |
| Dedicated AA | `aa_turret`, `gatling_rover`, `missile_buggy`, `interceptor`, `goliath_gunship` |
| Upgrade-based AA | `marine`, `sniper`, `grenadier`, `flamethrower` |
| No AA by default | Most tanks, melee, artillery, utility supports |

Recommended first pass:

1. Remove native `canTargetAir` from `marine` and `heavy_gunner`, or reduce their
   anti-air effectiveness through damage multipliers.
2. Keep `sniper` AA only if its role is "precision marksman"; otherwise move AA to
   `aerial_specialization`.
3. Ensure flying units have real counters, not universal counters.

### P2: Utility support role separation

| Unit | Proposed utility identity |
| --- | --- |
| `medic` | Organic single-target/squad healing. |
| `engineer` | Mechanical repair and shield restoration. |
| `officer` | Damage/targeting/formation aura. |
| `nanite_generator` | Area regeneration, cleanse, or revive-lite. |
| `shield_emitter` | Shield aura or periodic shield pulses. |
| `radar_zepplin` | Reveal, anti-stealth, range/targeting relay. |

### P2.5: Mechabellum-style missing counters

| Counter layer | Why it matters | Candidate units |
| --- | --- | --- |
| Projectile defense | Creates counterplay against artillery and missiles. | `shield_emitter`, `radar_zepplin`, `gatling_rover` |
| Shield breaking | Prevents guard/fortress compositions from becoming mandatory. | `emp_drone`, `hacker_rover`, `ion_crawler` |
| Anti-summoner | Stops War Factory-style snowball loops. | `bounty_hunter`, `stealth_operative`, `hacker_rover` |
| Anti-stealth/reveal | Gives stealth units a real risk/reward contract. | `radar_zepplin`, `scout_drone`, `officer` |
| Anti-giant ramping | Lets small armies answer XL anchors without universal DPS. | `ion_crawler`, `railgun_walker`, `plasma_tank` |
| Area denial | Makes approach lanes and clumps tactically dangerous. | `minelayer_rover`, `flamethrower`, `grenadier`, `siege_tank` |
| Formation disruption | Punishes dense formations without just adding more AoE damage. | `gravity_manipulator`, `sonic_devastator`, `cryo_tank` |
| Disable control | Creates windows where high-value units cannot use attacks/upgrades. | `emp_drone`, `railgun_walker`, `sonic_devastator` |
| Hack control | Gives support hunters a unique payoff beyond damage. | `hacker_rover` |
| Movement control | Lets armies kite, peel, or hold fast attackers in kill zones. | `cryo_tank`, `gravity_manipulator`, `minelayer_rover` |
| Vision/range suppression | Counters snipers and artillery without simply killing them faster. | `radar_zepplin`, `sonic_devastator`, future smoke units |
| Vulnerability debuff | Creates focused burst windows against anchors and giants. | `ion_crawler`, `emp_drone`, `nanite_generator` |
| Tempo pressure | Forces early reaction without becoming a universal damage carry. | `shock_trooper`, `scavenger_buggy`, `jetpack_trooper`, `scout_drone` |

### P3: Tier 1 retune

The early roster should teach clean counters:

| Unit | Keep | Reduce/limit |
| --- | --- | --- |
| `marine` | Baseline carry flexibility | Native AA and/or DPS |
| `shock_trooper` | Fast screen pressure | Total DPS or durability |
| `flamethrower` | Screen Clear AoE | Air/armor relevance |
| `medic` | Utility support learning | Damage role |
| `grenadier` | Mid-range AoE | Single-target efficiency |
| `heavy_gunner` | Sustained carry/suppression | Overlap with marine/AA |
| `sapper` | Burst demolition | Reliability and survivability |

## Upgrade Implications

Upgrades should transform role instead of only increasing stats. Good examples to
keep and expand:

| Upgrade | Role transformation |
| --- | --- |
| `portable_shield` | Marine becomes guard-capable carry. |
| `range_enhancement` | Ranged unit shifts into range pressure posture. |
| `emp_rounds` | Marksman/heavy gunner becomes disable-control specialist counter. |
| `anti_aircraft_ammo` | Ground unit becomes emergency anti-air specialist. |
| `subterranean_blitz` | Screen unit becomes engage/survivability pressure. |
| `incendiary_ammo` | Projectile unit becomes area denial/screen clear. |

Missing upgrade categories:

1. Shield-breaker.
2. Anti-summoner.
3. Anti-stealth/reveal.
4. Armor-piercing with drawback.
5. Formation disruption.
6. Projectile defense/interception.
7. Anti-giant ramping damage.
8. Utility support specialization: repair vs heal vs shield.
9. Role-swap upgrades for Tech Carrier units.
10. Tempo-pressure upgrades with explicit late-game falloff.
11. Area-denial upgrades that create hazards instead of direct stat inflation.
12. Disable-control upgrades that shut down abilities without deleting targets.
13. Hack-control upgrades with clear break conditions and counterplay.
14. Movement-control upgrades with duration and stacking caps.
15. Vision/range suppression upgrades for anti-sniper and anti-artillery play.
16. Vulnerability-debuff upgrades that enable burst without replacing anti-heavy units.
17. Cleanse/status-removal upgrades for fire, acid, smoke, and control recovery.
18. Status-immunity upgrades with narrow windows or explicit aura boundaries.
19. Flat damage block and damage-sharing upgrades for guard and anchor units.
20. Stance/mode transformations that alter movement, range, and targeting.
21. Target-mark upgrades for priority overrides and focus-fire control.
22. Burrow/underground movement states with clear reveal and counter rules.
23. Ramp/charge scaling upgrades for anti-giant and late-fight carry units.
24. Multi-weapon, split-fire, and chain-attack upgrades.
25. On-death and on-kill effects with deterministic caps.
26. Percent-HP damage upgrades for anti-giant roles.
27. Output-suppression upgrades that reduce attack cadence without full EMP.
28. Armor-break, armor-pierce, and shield-bypass upgrades.
29. Degeneration upgrades for anti-regen and anti-giant pressure.
30. Haste/rage upgrades with explicit trigger and duration rules.
31. Temporary battlefield-object upgrades: barriers, mines, wreckage, decoys.
32. Attack-geometry upgrades: beam, cone, line pierce, and barrage shapes.

## Next Implementation Slices

1. Normalize `StatusEffect` and implement P0 statuses: `emp`, `slow`, `burn`,
   `acid`, and `vulnerable`.
2. Implement P0 mechanics for `emp_drone`, `cryo_tank`, `shield_emitter`, and
   `hacker_rover`.
3. Add regression tests for no-op utility support and control-role units.
4. Normalize anti-air capability in config and tests.
5. Split utility support healing/repair/buff behavior.
6. Add P1 statuses: `range_suppressed`, `revealed`, `hacked`,
   `damage_reduction`, and `regen`.
7. Retune Tier 1 infantry using simulator metrics.
8. Add a balance table test that flags units with `attack: 0` and no implemented
   utility mechanic.
9. Add defensive primitives: flat damage block, damage sharing, status immunity,
   and reactive armor charges.
10. Add transform/control primitives: stance transforms, target marks, burrow,
    ramp/charge scaling, and percent-HP damage.
11. Add weapon/death primitives: split fire, chain attacks, periodic side
    weapons, on-death effects, and on-kill recycling.
12. Add advanced statuses and attack shapes: `output_suppressed`,
    `armor_broken`, `degeneration`, `haste`, beams, cones, line pierce, and
    temporary battlefield objects.
