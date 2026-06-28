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
| Anchor / Frontline | Holds the line, absorbs first contact, protects carries, occupies melee slots. |
| Screen | Cheap bodies or decoys that distract stronger enemies and waste target locks. |
| Screen Clear | AoE, multi-target, or rapid attacks that remove many light units. |
| Carry | Main damage investment unit that scales with upgrades and army support. |
| Specialist Counter | Narrow answer to a specific threat: heavy, shield, summon, stealth, or air. |
| Anti-air | Dedicated specialist counter for flying units. |
| Anti-heavy / Anti-giant | Kills armored, XL, high-HP, or high-value single targets efficiently. |
| Range Pressure | Long-range artillery/sniper pressure that forces enemy positioning answers. |
| Backline Hunter | Reaches fragile carries, healers, summoners, artillery, or low-HP targets. |
| Utility Support | Heals, repairs, shields, buffs, reveals, intercepts missiles, or extends range. |
| Control | Applies EMP, slow, freeze, smoke, displacement, hack, disable, or debuff. |
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
| tanky carry / guard | Anchor / Frontline |
| anti-giant | Anti-heavy / Anti-giant |
| artillery / sniper pressure | Range Pressure |
| tech card / specialist answer | Specialist Counter |
| support aura / radar / interceptor | Utility Support |
| production tech | Summoner / Decoy |

The most important Mechabellum lesson is that upgrades should transform roles.
For example, a baseline carry can become emergency anti-air, an anchor can become
projectile defense, or an anti-giant beam can become anti-medium through split
fire. This document tracks intended functions; runtime should still use
`combatTags`, `targetingProfile`, upgrades, and explicit mechanics.

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
| `wall` | Static anchor/structure | 500 HP, 0 speed, armored heavy structure | Ready | Good defensive obstacle. Needs economy/building context more than combat changes. |
| `turret` | Static local defense | 200 HP, 240 range, can target air | Tune | General defense overlaps with AA turret. Consider lower AA efficiency. |
| `aa_turret` | Static anti-air specialist | 150 HP, 280 range, `anti_air` profile | Ready | Keep as dedicated air counter. |
| `drone` | Legacy light air screen | Deprecated name, 3-unit flying squad, short range | Legacy | Do not balance around this if `scout_drone` replaces it. |
| `rocketeer` | Legacy screen clear | Deprecated, AoE, can target air | Legacy | Avoid using as modern roster baseline. |
| `alien_bug` | PvE screen | 10-unit melee squad, fast, low HP | Ready | Good swarm test target. |
| `alien_spitter` | PvE screen clear/range pressure | 3-unit ranged AoE squad | Ready | Works as ranged alien pressure. |
| `alien_worm` | PvE heavy anchor/control | Heavy AoE melee, low DPS | Tune | Needs either more durability or a control identity. |
| `marine` | Baseline carry | 8 units, 280 total HP, high DPS, can AA | Tune | Too universal. Consider removing native AA or lowering DPS. |
| `shock_trooper` | Fast melee screen-pressure | 8 units, 360 total HP, very high DPS | Tune | Too efficient for baseline melee. Needs clearer weakness to AoE/ranged. |
| `flamethrower` | Short-range screen clear | 4 units, low range AoE | Ready | Good identity. Later add burn/status version. |
| `scout_drone` | Fast air screen/scout | 5 units, high speed, can AA | Tune | Strong generalist flyer. Needs fragility or scouting utility. |
| `medic` | Organic utility support | 3 units, heal attack, short support range | Ready | Good early support. Should not be a damage unit. |
| `sniper` | Range pressure/backline hunter | 2 units, 280 range, `assassin`, can AA | Tune | Good role, but AA may dilute anti-air specialists. |
| `scavenger_buggy` | Fast pressure/cleanup | 3 vehicles, very fast, short range | Tune | Needs raider/cleanup identity: low-HP bonus, flank, or resource/pillage theme. |
| `grenadier` | Mid-range screen clear | 4 units, AoE, explosive tag | Ready | Solid anti-clump role. Can gain AA through upgrade only. |
| `heavy_gunner` | Sustained carry/suppression | 6 units, 200 range, high DPS, can AA | Tune | Overlaps marine/gatling. Should become suppression or screen clear specialist. |
| `sapper` | Demolition backline hunter | 3 units, high AoE burst, low HP | Ready | Good high-risk unit. Ensure it does not overperform with melee slots. |
| `officer` | Command utility support | Currently `attackType: heal` | Needs mechanic | Should become buff/targeting aura, not another healer. |
| `jetpack_trooper` | Flying pressure/backline hunter | 5 flying units, fast melee | Tune | Interesting, but needs clear counter and role versus scout drones. |
| `exosuit` | Medium anchor/bruiser | 4 units, armored heavy, low range | Ready | Good bridge between infantry and vehicles. |
| `gatling_rover` | Anti-air/screen clear specialist | 2 vehicles, rapid fire, `anti_air` | Ready | Good dedicated AA. Could also counter light screens. |
| `plasma_tank` | Anti-heavy specialist | 2 vehicles, `anti_armor`, medium range | Ready | Clear role. Needs armor-piercing tuning once DR exists. |
| `missile_buggy` | Mobile anti-air specialist | 3 vehicles, long range, `anti_air` | Ready | Clear, should be weaker into ground general targets. |
| `gunship` | Air-to-ground carry | 2 flying armored units, ground-only | Ready | Good air pressure. Needs dedicated AA counters to matter. |
| `engineer` | Mechanical utility support | Currently healer with weak attack | Needs mechanic | Should repair mechanical/shields, not heal organic equally. |
| `emp_drone` | Flying control specialist | Attack 0, support hunter, no EMP flag in base config | Needs mechanic | Critical fix. Should apply EMP or disable, not chip for 1 damage. |
| `minelayer_rover` | Area denial/control | Currently normal attack vehicle | Needs mechanic | Needs mine placement, delayed trigger, or hazard generation. |
| `siege_tank` | Range pressure/screen clear | 320 range, AoE, `siege` profile | Ready | Strong identity. Watch target acquisition and overkill. |
| `railgun_walker` | Range pressure/anti-heavy | 280 range, `long_range_priority` | Ready | Good heavy hunter. EMP rounds upgrade fits well. |
| `drone_carrier` | Air summoner/screen producer | Flying, `spawn`, summons scout drones | Tune | Good concept. Validate spawn cadence and target behavior. |
| `cryo_tank` | Heavy control/screen clear | Currently AoE damage only | Needs mechanic | Should apply slow/freeze or DR debuff. |
| `shield_emitter` | Utility support/anchor | Currently no aura/shield action | Needs mechanic | Must grant shields/DR aura or intercept projectiles. |
| `interceptor` | Air superiority specialist | Flying, can AA, `anti_air` | Ready | Clear anti-air flyer. Should be mediocre vs ground. |
| `hacker_rover` | Control/specialist counter | Attack 0, support hunter, no hack mechanic | Needs mechanic | Should disable shields/summoners/targeting or convert temporarily. |
| `artillery_crawler` | Extreme range pressure | 400 range, massive AoE hit, slow cooldown | Ready | Clear late-game artillery. Needs minimum range or vulnerability. |
| `titan_mech` | XL anchor/carry | 800 HP, AoE, can AA, anti-armor | Tune | Too many strengths. Needs explicit weakness: EMP, screen pressure, slow turn. |
| `behemoth_tank` | XL anchor | 1200 HP, single target, default profile | Ready | Good pure tank. Needs threat low enough to be ignorable or body-blocking value. |
| `ion_crawler` | Anti-giant carry | 600 HP, rapid low attack, anti-armor | Tune | Needs ramping/beam identity; otherwise it is just another heavy DPS unit. |
| `goliath_gunship` | XL air anchor/AA carry | 1000 HP, can AA, anti-air profile | Tune | Very strong profile. Needs hard counters from AA/EMP. |
| `mobile_factory` | Summoner/anchor | 900 HP, spawns exosuits | Tune | Good boss unit. Validate snowball and spawn cap. |
| `sonic_devastator` | XL control/screen clear | Currently AoE damage only | Needs mechanic | Should apply knockback/stun/disruption, not plain AoE. |
| `radar_zepplin` | Utility support/reveal | No attack, no reveal/targeting buff | Needs mechanic | Should provide true sight, range, anti-stealth, or targeting relay. |
| `stealth_operative` | Backline hunter | Stealth tag/profile, high single damage | Tune | Needs full stealth/reveal contract with radar/hunter counters. |
| `hologram_projector` | Decoy summoner | Spawns exosuits currently | Needs mechanic | Should spawn low-HP decoys, not real exosuits unless intentional. |
| `gravity_manipulator` | Control anchor | Very low DPS AoE, no gravity effect | Needs mechanic | Should pull, slow, clump, or disrupt formations. |
| `nanite_generator` | AoE utility support | Currently generic heal vehicle | Needs mechanic | Should be regen aura or mechanical repair specialist. |
| `bounty_hunter` | Backline hunter/anti-heavy | Long range, can AA, assassin profile | Tune | Clear role, but may overlap sniper/stealth operative. Needs unique execute/mark mechanic. |

## Priority Fix List

### P0: Broken or misleading units

These units promise a mechanic that the simulation does not currently provide:

1. `emp_drone` - add base EMP application or a dedicated disable attack.
2. `shield_emitter` - add shield aura or periodic shield grant.
3. `hacker_rover` - add hack/disable behavior.
4. `cryo_tank` - add slow/freeze.
5. `gravity_manipulator` - add pull/slow/formation disruption.
6. `radar_zepplin` - add reveal/targeting relay.
7. `minelayer_rover` - add mine/hazard placement.
8. `sonic_devastator` - add knockback/stun/disrupt.
9. `hologram_projector` - spawn decoys, not normal combat units.
10. `officer` - replace generic heal with command aura/buff.

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
| Shield breaking | Prevents shield anchors from becoming mandatory. | `emp_drone`, `hacker_rover`, `ion_crawler` |
| Anti-summoner | Stops War Factory-style snowball loops. | `bounty_hunter`, `stealth_operative`, `hacker_rover` |
| Anti-stealth/reveal | Gives stealth units a real risk/reward contract. | `radar_zepplin`, `scout_drone`, `officer` |
| Anti-giant ramping | Lets small armies answer XL anchors without universal DPS. | `ion_crawler`, `railgun_walker`, `plasma_tank` |

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
| `portable_shield` | Marine becomes anchor-capable carry. |
| `range_enhancement` | Ranged unit shifts into range pressure posture. |
| `emp_rounds` | Marksman/heavy gunner becomes control specialist counter. |
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

## Next Implementation Slices

1. Implement P0 mechanics for `emp_drone` and `shield_emitter`.
2. Add regression tests for no-op utility support/control units.
3. Normalize anti-air capability in config and tests.
4. Split utility support healing/repair/buff behavior.
5. Retune Tier 1 infantry using simulator metrics.
6. Add a balance table test that flags units with `attack: 0` and no implemented
   utility mechanic.
