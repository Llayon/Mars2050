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

Current runtime status support is centralized in `combat.status.ts`. The active
typed set is `emp`, `slow`, `burn`, `acid`, `vulnerable`,
`range_suppressed`, `revealed`, `hacked`, `damage_reduction`, `regen`,
`output_suppressed`, `accuracy_reduced`, `armor_broken`, `degeneration`, `haste`, and
`range_boost`.
Status application, refresh, strongest-value selection, ticking, expiration,
and cleanse all emit deterministic replay actions when an action sink is passed.
Adjacent non-status state still lives on `SimUnit`: `shield`,
`stealthUntilAttack`, `lifestealMult`, `armorPierceRatio`,
`summonCounterDamageMult`, `damageReductionWhileMoving`, `burrowConfig`,
`isBurrowed`,
`onDeathPuddle`, temporary spawns, and hazards.

### Core statuses to add first

| Status | Role category | Intended behavior | Primary users |
| --- | --- | --- | --- |
| `emp` | Disable Control | Temporarily disables attacks, upgrades, shields, or targeting hooks. | `emp_drone`, `railgun_walker`, global EMP |
| `slow` | Movement Control | Multiplies movement speed for a fixed duration. | `cryo_tank`, `gravity_manipulator`, mines |
| `burn` | Area Denial | Deals damage over time and can be applied by fire hazards. | `flamethrower`, napalm, incendiary upgrades |
| `acid` | Area Denial / Vulnerability Debuff | Deals DoT or weakens armor/giants in a zone. | `alien_bug`, `alien_spitter`, anti-giant upgrades |
| `vulnerable` | Vulnerability Debuff | Increases incoming damage or reduces armor/defense. | `ion_crawler`, `emp_drone`, `nanite_generator` |
| `range_suppressed` | Vision / Range Suppression | Reduces range, accuracy, or target acquisition. | `radar_zepplin`, `sonic_devastator`, smoke units |
| `revealed` | Anti-stealth / Utility Support | Allows targeting stealth units, cancels hidden bonuses, and breaks active burrow. | `radar_zepplin`, `sensor_suite`, `scout_drone`, `officer` |
| `hacked` | Hack Control | Temporarily converts, confuses, or redirects a target. | `hacker_rover` |
| `damage_reduction` | Guard / Protector | Reduces incoming damage for a duration. | `shield_emitter`, `officer`, photon-like upgrades |
| `regen` | Utility Support | Restores HP over time. | `engineer`, `nanite_generator`, repair upgrades |

### Advanced / optional statuses

| Status | Role category | Intended behavior | Primary users |
| --- | --- | --- | --- |
| `output_suppressed` | Disable Control | Reduces attack speed, damage, or ability cadence without fully disabling the unit. | suppression rounds, sonic weapons, smoke/sandstorm effects |
| `accuracy_reduced` | Vision / Range Suppression | Converts smoke and targeting disruption into deterministic glancing damage. | smoke fields, future sandstorm/optics counters |
| `armor_broken` | Vulnerability Debuff | Reduces flat armor, damage block, or mitigation separately from generic damage vulnerability. | acid weapons, ion weapons, armor-piercing upgrades |
| `degeneration` | Vulnerability Debuff / Anti-giant | Drains HP, blocks regeneration, or applies percent-style decay over time. | ion weapons, anti-giant beams, late-game debuff units |
| `haste` | Tempo Pressure / Carry | Temporarily increases movement, attack cadence, or reload speed. | rage upgrades, charge upgrades, officer buffs |
| `range_boost` | Utility Support / Range Pressure | Temporarily increases acquisition, positioning, and action range. | `radar_zepplin`, targeting relay upgrades |

### Mechanics that should not be plain statuses

| Mechanic | Reason |
| --- | --- |
| Shield HP | Needs numeric absorb, break logging, and shield-specific counters. |
| Stealth | Requires acquisition rules, reveal counters, and first-attack behavior. |
| Lifesteal | Depends on actual damage dealt, not a passive tick. |
| Revive / reassembly | Needs death interception and delayed respawn logic. |
| Pull / knockback | Should be a forced movement event with collision and pathing rules. |
| Projectile interception | Needs projectile or attack-event filtering, not per-unit ticking. |
| Burrow / underground | Depends on movement intent, replay state changes, and reveal/counter rules. |

### Implemented runtime contract

1. `StatusEffect` is typed with `type`, `duration`, optional `value`,
   optional `sourceUnitId`, optional `stackKey`, and optional hack `controlMode`.
2. Same stack identity refreshes duration and keeps the strongest value.
3. `emp` blocks attacks, heals, support actions, and spawns; `hacked`
   supports disable, redirect, and confuse control modes.
4. `slow` and `haste` modify movement speed in `combat.movement.ts`.
5. `burn`, `acid`, `degeneration`, and `regen` tick every 10 simulation ticks.
6. `vulnerable`, `damage_reduction`, `armor_broken`,
   `output_suppressed`, and `accuracy_reduced` feed into `combat.damage.ts`.
7. `revealed` participates in stealth acquisition checks and breaks/suppresses active burrow defense.
8. Shield, stealth, lifesteal, armor pierce, anti-summoner damage,
   pull/knockback, mines, barriers, and decoys
   remain explicit mechanics with their own tests.

### Implemented primitive status

The following mechanics are now implemented as reusable runtime primitives:

| Primitive | Runtime files | Current users |
| --- | --- | --- |
| Detailed damage/shield events | `combat.damage.ts` | all attacks through `applyCombatDamage` |
| Shield-breaker damage | `combat.damage.ts`, `combat.upgrades.ts` | `shield_breaker_rounds` |
| Armor-pierce damage | `combat.damage.ts`, `combat.upgrades.ts` | `armor_piercing_rounds` |
| Anti-summoner damage | `combat.summon-counter.ts`, `combat.damage.ts`, `combat.upgrades.ts` | `anti_summoner_protocol` |
| Shield aura / shield repair / regen / cleanse / immunity | `combat.auras.ts`, `combat.status.ts` | `shield_emitter`, `engineer`, `nanite_generator` |
| Anti-stealth reveal aura | `combat.auras.ts`, `combat.status.ts`, `combat.upgrades.ts` | `radar_zepplin`, `sensor_suite` |
| Accuracy suppression / optics resist | `combat.accuracy.ts`, `combat.damage.ts`, `combat.smoke.ts`, `combat.upgrades.ts` | smoke fields, `thermal_optics` |
| Command haste aura | `combat.auras.ts`, `combat.status.ts` | `officer` |
| Range relay aura | `combat.auras.ts`, `combat.status.ts` | `radar_zepplin` |
| Tag-limited repair | `combat.support.ts`, `combat.targeting.ts` | `engineer` |
| Mine placement | `combat.minefield.ts` | `minelayer_rover` |
| Smoke suppression field | `combat.smoke.ts`, `combat.hazards.ts`, `combat.status.ts` | configurable `smokeOnAction` units/upgrades |
| Pull / knockback displacement | `combat.displacement.ts` | `gravity_manipulator`, `sonic_devastator` |
| Decoys / temporary barriers | `combat.systems.utils.ts` | `hologram_projector`, `shield_emitter` |
| Projectile interception | `combat.projectile-defense.ts`, `combat.damage.ts` | `shield_emitter` |
| Cone / beam / barrage / chain / split-fire / side weapons | `combat.attack-geometry.ts`, `combat.split-fire.ts`, `combat.side-weapon.ts` | `flamethrower`, `sonic_devastator`, `ion_crawler`, `artillery_crawler`, `plasma_tank`, `gatling_rover`, `goliath_gunship` |
| Minimum range / back-away positioning | `combat.weapon-rules.ts`, `combat.positioning.ts` | `artillery_crawler` |
| Stance / mode transform | `combat.stance.ts`, `combat.mode.ts`, `combat.status.ts`, `combat.movement.ts` | `artillery_crawler`, `jetpack_trooper` |
| Burrow / underground movement | `combat.burrow.ts`, `combat.movement.ts`, `combat.damage.ts` | `subterranean_blitz` |
| Ramp focused-fire damage | `combat.ramp.ts` | `ion_crawler` |
| Charge damage scaling | `combat.charge.ts`, `combat.movement.ts` | `scavenger_buggy` |
| Percent-HP damage | `combat.percent-damage.ts`, `combat.damage.ts` | `railgun_walker` |
| On-kill effects | `combat.on-kill.ts` | `stealth_operative` |

Remaining design/balance gaps are richer mode-switch variants, richer
underground counter variants, PvP tuning for permanent conversion control, and
richer line-of-sight/concealment mechanics.

### Damage / shield pipeline

Damage now flows through `combat.damage.ts` before HP is mutated. The current
pipeline applies defense after armor break and attacker armor pierce, output suppression, deterministic accuracy penalties, air/ground/shield/anti-summoner damage multipliers,
movement damage reduction, status damage modifiers, shield absorption, execute,
lifesteal, and final HP damage.

Shield overflow is intentional: if a hit exceeds the current shield value, the
shield absorbs only its remaining capacity and the leftover damage reaches HP.
`shieldDamageMult` makes a hit spend its damage budget more efficiently against
shield HP. It does not multiply HP damage when the target has no shield.
`armorPierceRatio` is attacker-side mitigation bypass: it reduces remaining
target defense for that hit after `armor_broken`, without applying a status or
increasing damage against unarmored targets.
`summonCounterDamageMult` is attacker-side specialist damage against summoners,
spawned units, and temporary decoys. It does not increase damage against normal
frontline units.
`burrowConfig` is a movement-state defense: the unit emits `burrow_change` when
it enters or exits underground movement, and the reduction applies only while
`isBurrowed` is active. Applying `revealed` forces the unit to surface and
prevents re-entering burrow until reveal expires.
The detailed replay stream can emit:

| Action | Meaning |
| --- | --- |
| `damage` | Final HP damage after mitigation and shield absorption. |
| `shield_damage` | Amount absorbed by shield HP. |
| `shield_break` | Shield reached zero from the hit. |
| `lifesteal` | Attacker healed from actual HP damage dealt. |
| `unit_blocked_damage` | Damage removed by defense, status reduction, or other mitigation. |
| `burrow_change` | Unit entered or exited underground movement state. |
| `mode_change` | Unit changed runtime ground/air mobility state. |

The legacy `attack` replay action is still emitted for projectile, recoil, and
old replay compatibility. The active `/simulator2` replay entry point exports
the canvas renderer through `battle-replay-engine.ts`; it applies detailed
`damage`, `damage_share`, and `lifesteal` events for HP/text while still
supporting old attack-only logs. Replay labels/colors live in
`battle-replay-labels.ts`, with coverage enforced against `BATTLE_ACTION_TYPES`
by `battle-replay-labels.test.ts`.

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
| Anti-summoner Damage | Factory mark, replicate counters, anti-spawn tech. | Specialist counters that pressure summoners and temporary units without becoming universal DPS. |
| Temporary Battlefield Objects | Barrier, mines, field entrenchment, wreckage, decoys. | Short-lived map objects with HP, collision, targeting, or hazard behavior. |
| Stat Buff / Debuff Windows | Mechanical Rage, Suppression Shots, combat evolvement effects. | Timed or conditional output changes that are not full control effects. |

### Primitive implementation order

1. Defensive primitives: flat damage block, damage sharing, status immunity,
   reactive armor charges, and projectile interception are implemented.
2. Role-transform primitives: target marks, initial siege/entrenched stance transforms, movement-state burrow with reveal counterplay, and first-pass ground/air mobility mode swaps are implemented; richer mode-switch variants and richer underground counter variants remain content/design work.
3. Scaling primitives: ramp damage, charge scaling, and percent HP damage are implemented.
4. Weapon primitives: chain attacks, split fire, and side weapons are implemented; richer role-specific upgrade variants remain future work.
5. Death/kill primitives: on-death puddles, on-death explosion/spawn triggers, reassembly, on-kill effects, and capped replicate/spawn flows are implemented; remaining work is unit content selection and tuning.
6. Attack-shape primitives: beam, cone, line pierce, and barrage are implemented; temporary battlefield objects exist as mines/smoke/barriers/decoys.

## Global Findings

1. Tier 1 infantry is too compressed. `marine`, `heavy_gunner`, and `sniper` still
   compete as ranged carry roles, while `shock_trooper` is a very efficient melee
   screen-pressure baseline.
2. Dedicated anti-air was diluted by generalist AA. First-pass cleanup now keeps
   baseline air targeting mostly on dedicated counters and upgrade paths.
3. Several high-concept units are currently placeholders: their config names imply
   mechanics that do not exist in `actionSystem`.
4. Utility support units need sharper separation. `medic`, `officer`,
   `engineer`, and `nanite_generator` should not all be generic healers.
5. Heavy units are broadly readable, but they need stronger counterplay tuning from EMP,
   armor-piercing rounds, swarm pressure, and shield-breaking.
6. Several units should be documented as Tech Carriers: their upgrades should
   change battlefield function, not only increase stats.

## Status Legend

| Status | Meaning |
| --- | --- |
| Ready | Role is understandable and mostly represented in current mechanics. |
| Tune | Works, but numbers/profile likely need balancing. |
| Needs mechanic | Name/role promises behavior that is not implemented yet. |
| Legacy | Old/static/PvE-only unit that should not drive PvP balance. |

## Tier 1 Role Matrix

Tier 1 should teach readable counters before exact numeric balance. These roles
are the contract for the dedicated Tier 1 balance scenarios included in
`npm run combat:snapshot`.

| Unit | Primary job | Strength | Weakness / counter | Role signal |
| --- | --- | --- | --- | --- |
| `marine` | Baseline line carry | Flexible ground DPS and clean reference point for balance comparisons. | Should lose specialist races against AoE, burst demolition, suppression, and flank access. | Sustained `damage` without special replay primitives. |
| `heavy_gunner` | Sustained fire / suppression candidate | Wins when protected long enough to keep firing. | Slow, angle-dependent, vulnerable to burst, flankers, and long-range priority fire. | High `attack`/`damage` cadence plus `output_suppressed` applications. |
| `grenadier` | Mid-range anti-clump | Punishes dense light formations and melee blobs. | Inefficient into scattered, fast, or high-HP single targets. | Multi-target `damage` from AoE splash. |
| `flamethrower` | Short-range burn screen clear | Cone pressure plus `burn` makes it anti-swarm and anti-armor-over-time. | Must enter danger range; should not replace sapper demolition or ranged carry DPS. | `cone_attack` plus `status_apply: burn`. |
| `sapper` | Burst demolition assassin | Deletes static guards, walls, or clumped high-value targets if it reaches them. | Low HP, low uptime, poor sustained fight value after burst window. | Large short-range `damage`, not burn or suppression. |
| `shock_trooper` | Melee tempo pressure | Forces immediate response and breaks weak rifle lines. | Should be answered by AoE, kiting, burn zones, and protected sustained fire. | Fast engage, melee `damage`, high casualty exposure. |
| `jetpack_trooper` | Flanker / backline access | Crosses space quickly and pressures fragile support or ranged units. | Exposed to AA while moving and weaker in a direct brawl than pure melee. | `mode_change` before committing to attack. |
| `sniper` | Precision range pressure | Deletes low-HP or support targets from long range. | Low body count, overkill risk, vulnerable if screened or flanked; success is support removal, not winning a frontline duel. | Long-range `damage` from assassin profile. |
| `scout_drone` | Fast air scout / harassment | Tests whether the opponent brought dedicated AA. | Fragile and should lose to real anti-air. | Flying harassment damage in the AA check scenario. |
| `medic` | Organic sustain support | Extends frontline uptime through direct healing. | Does not solve burst, armor, shields, structures, or mechanical repair. | `heal` actions and `healingDoneByUnitType.medic`. |
| `officer` | Command aura support | Improves nearby formation tempo without being a healer. | No direct damage, depends on allied units and aura positioning. | `status_apply: haste`. |
| `scavenger_buggy` | Fast charge flanker | Converts travel distance and angle into burst pressure. | Needs room to accelerate; weak into hard stops and sustained focus. | `charge_damage`. |

## Current Roster Review

| Unit | Intended role | Current facts | Status | Notes |
| --- | --- | --- | --- | --- |
| `wall` | Static fortress anchor/structure | 500 HP, 0 speed, armored heavy structure | Ready | Good defensive obstacle. Needs economy/building context more than combat changes. |
| `turret` | Static local defense | 200 HP, 240 range, ground-only | Tune | General defense no longer overlaps AA turret by default. Tune DPS versus ground pushes. |
| `aa_turret` | Static anti-air specialist | 180 HP, 280 range, `anti_air` profile | Ready | Keep as dedicated air counter; price should reflect hard-counter value. |
| `drone` | Legacy light air screen | Deprecated name, 3-unit flying squad, short range | Legacy | Do not balance around this if `scout_drone` replaces it. |
| `rocketeer` | Legacy screen clear | Deprecated, AoE, can target air | Legacy | Avoid using as modern roster baseline. |
| `alien_bug` | PvE screen | 10-unit melee squad, fast, low HP | Ready | Good swarm test target. |
| `alien_spitter` | PvE screen clear/range pressure | 3-unit ranged AoE squad | Ready | Works as ranged alien pressure. |
| `alien_worm` | PvE damage tank/disruptor | Heavy AoE melee, low DPS | Tune | Needs either more durability or a formation disruption identity. |
| `marine` | Baseline carry | 8 units, 280 total HP, high DPS, no native AA | Tune | Less universal after AA cleanup. Can become emergency AA through upgrades. |
| `shock_trooper` | Tempo pressure/screen | 8 units, 360 total HP, very high DPS | Tune | Too efficient for baseline melee. Needs clearer weakness to AoE/ranged. |
| `flamethrower` | Short-range screen clear | 4 units, low range cone plus burn | Ready | Good identity. Keep it distinct from sapper burst: burn/DoT and cone pressure, not demolition. |
| `scout_drone` | Fast air screen/scout | 5 units, high speed, air-to-ground only | Tune | Fragile flyer/scout baseline. Can take `sensor_suite` for anti-stealth reveal. |
| `medic` | Organic utility support | 3 units, heal attack, short support range | Ready | Good early support. Should not be a damage unit. |
| `sniper` | Precision range pressure/assassin | 2 units, 280 range, `assassin`, no native AA | Tune | Good ground precision role. AA should remain upgrade-based if needed. |
| `scavenger_buggy` | Tempo pressure/flanker | 3 vehicles, very fast, short range, movement-distance charge damage | Tune | Now has raider burst identity. Tune charge cap, cooldown, and counterplay. |
| `grenadier` | Mid-range screen clear | 4 units, AoE, explosive tag | Ready | Solid anti-clump role. Can gain AA through upgrade only. |
| `heavy_gunner` | Sustained carry/suppression | 6 units, 200 range, high DPS, no native AA | Tune | Overlaps marine/gatling less after AA cleanup. Should become suppression or screen clear specialist. |
| `sapper` | Demolition assassin | 3 units, high AoE burst, low HP | Ready | Good high-risk unit. Ensure it does not overperform with melee slots. |
| `officer` | Command utility support | Passive haste aura for nearby allies; can add sensor-suite reveal | Tune | No longer a generic healer. Tune radius/value so it supports formations without becoming mandatory. |
| `jetpack_trooper` | Jump flanker/backline killer | 5 infantry, fast melee, enters air mode while moving and lands before attacking | Tune | Now has a ground/air mode identity: exposed to AA while advancing, targetable by ground weapons when committed. Tune timing and counters versus scout drones. |
| `exosuit` | Medium damage tank/bruiser | 4 units, armored heavy, low range | Ready | Good bridge between infantry and vehicles. |
| `gatling_rover` | Anti-air/screen clear specialist | 2 vehicles, rapid fire, `anti_air`, split fire | Ready | Good dedicated AA and light-screen clearer. Tune split-fire multiplier if it crowds out infantry clear. |
| `plasma_tank` | Anti-heavy specialist | 2 vehicles, `anti_armor`, medium range | Ready | Clear role. Can take armor-piercing rounds; tune chain damage versus medium armor. |
| `missile_buggy` | Mobile anti-air specialist | 3 vehicles, long range, `anti_air` | Ready | Clear, should be weaker into ground general targets. |
| `gunship` | Air-to-ground carry | 2 flying armored units, ground-only | Ready | Good air pressure. Needs dedicated AA counters to matter. |
| `engineer` | Mechanical utility support | Repairs mechanical allies only, restores existing mechanical shields, plus cleanse/status-immunity aura | Tune | No longer heals organic units equally and does not grant fresh shields to unshielded units. |
| `emp_drone` | Flying disable control specialist | Attack 0, support hunter, applies `emp` on hit | Tune | Needs cadence/counter tuning so zero-damage utility is valuable but not oppressive. |
| `minelayer_rover` | Area denial/movement control | Deploys deterministic mines through `mineOnAction` | Tune | Needs visual clarity and trigger/radius balance. |
| `siege_tank` | Range pressure/screen clear | 320 range, AoE, `siege` profile | Ready | Strong identity. Watch target acquisition and overkill. |
| `railgun_walker` | Range pressure/anti-heavy | 280 range, `long_range_priority`, line pierce, capped percent-HP bonus | Ready | Good heavy hunter. Disable-control rounds upgrade fits well. |
| `drone_carrier` | Air summoner/screen producer | Flying, `spawn`, summons scout drones | Tune | Good concept. Validate spawn cadence and target behavior. |
| `cryo_tank` | Movement control/screen clear | AoE plus `slow` status on hit | Tune | Freeze/root can remain an upgrade; baseline slow is implemented. |
| `shield_emitter` | Guard/projectile defense | Shield aura, temporary barrier spawn, projectile interception | Tune | Now has a real projectile-defense hook. Tune cooldown, max damage, and visual clarity. |
| `interceptor` | Air superiority specialist | Flying, can AA, `anti_air` | Ready | Clear anti-air flyer. Should be mediocre vs ground. |
| `hacker_rover` | Hack control/specialist counter | Attack 0, support hunter, applies `hacked` redirect control | Tune | Redirect/confuse and conversion beam primitives exist; tune whether/which PvP configs use permanent control, break conditions, and cleanse counters. |
| `artillery_crawler` | Extreme range pressure | Minimum range, siege stance setup, deterministic barrage impacts | Ready | Clear late-game artillery. Watch overkill, setup timing, and minimum-range retreat behavior. |
| `titan_mech` | XL damage tank/carry | 800 HP, AoE, anti-armor, no native AA | Tune | Still has many strengths. Needs explicit weakness: EMP, screen pressure, slow turn. |
| `behemoth_tank` | XL damage tank | 1200 HP, single target, default profile | Ready | Good pure tank. Needs threat low enough to be ignorable or body-blocking value. |
| `ion_crawler` | Anti-giant carry | Beam secondary hits plus same-target `rampDamage` | Ready | Now has anti-giant focused-fire identity; tune cap and vulnerable uptime. |
| `goliath_gunship` | XL air fortress anchor/AA carry | 1000 HP, can AA, anti-air profile | Tune | Very strong profile. Needs hard counters from AA/EMP. |
| `mobile_factory` | Summoner/fortress anchor | 900 HP, spawns exosuits | Tune | Good boss unit. Validate snowball and spawn cap. |
| `sonic_devastator` | XL formation disruptor/screen clear | Cone attack, output/range suppression, deterministic knockback | Tune | Now has true formation disruption. Tune knockback strength and suppression uptime. |
| `radar_zepplin` | Utility support/reveal/range relay | Reveal aura plus ally range-boost aura, no damage | Tune | Has native anti-stealth and range relay identity. Tune aura radius/value. |
| `stealth_operative` | Stealth assassin/backline killer | Stealth tag/profile, high single damage, on-kill reset/heal | Tune | Needs full stealth/reveal tuning with radar/hunter counters. |
| `hologram_projector` | Decoy summoner | Spawns temporary low-HP exosuit decoys | Partial | Needs final target-priority and visual clarity tuning. |
| `gravity_manipulator` | Formation disruptor/guard | AoE plus deterministic pull-on-hit | Tune | Watch anti-sumo limits and collision side effects. |
| `nanite_generator` | AoE utility support | Heal action plus regen aura | Tune | Could specialize further into mechanical repair/cleanse. |
| `bounty_hunter` | Assassin/anti-heavy | Long range, assassin profile, target mark execute setup, no native AA | Tune | Can become anti-summoner through `anti_summoner_protocol`; watch overlap with sniper/stealth operative. |

## Priority Fix List

### P0: Remaining partial or misleading units

These units now have at least one runtime hook, but still need design/balance
completion before their role is considered finished:

1. `emp_drone` - applies EMP, but needs tuning around zero-damage utility cadence and counters.
2. `hacker_rover` - redirect/confuse plus conversion beam primitives exist; needs PvP tuning for thresholds, break conditions, and cleanse counters.
3. `radar_zepplin` - reveal and range relay exist; needs balance and possible targeting-priority relay variants.
4. `officer` - command haste aura exists; needs balance and possible targeting/formation aura variants.
5. `shield_emitter` - shield aura, temporary barrier, and projectile interception exist; cooldown/max-damage tuning remains.
6. `hologram_projector` - temporary low-HP decoys exist; needs final target-priority and visual clarity tuning.

### P0.5: Status contract

The status kernel is implemented. Remaining work is mostly balance and UX:

1. Tune durations/values for EMP, hacked, slow, burn, acid, vulnerable, and suppression.
2. Make status VFX readable in the replay without hiding unit silhouettes.
3. Add dedicated manual QA scenarios for cleanse/status immunity and control-heavy armies.
4. Tune hack redirect/confuse durations, conversion thresholds, and which PvP unit configs are allowed to use permanent control.

### P1: Anti-air cleanup

Target state:

| Unit class | Air targeting policy |
| --- | --- |
| Dedicated AA | `aa_turret`, `gatling_rover`, `missile_buggy`, `interceptor`, `goliath_gunship` |
| Upgrade-based AA | `marine`, `heavy_gunner`, `grenadier` |
| No AA by default | Most tanks, melee, artillery, utility supports |

First pass is implemented:

1. Native AA is removed from generalists such as `marine`, `heavy_gunner`,
   `sniper`, `scout_drone`, `titan_mech`, and `bounty_hunter`.
2. Dedicated AA keeps baseline air targeting through `aa_turret`,
   `gatling_rover`, `missile_buggy`, `interceptor`, and `goliath_gunship`.
3. Upgrade-based AA remains available through specialist upgrade paths.

### P2: Utility support role separation

| Unit | Proposed utility identity |
| --- | --- |
| `medic` | Organic single-target/squad healing. |
| `engineer` | Mechanical repair, mechanical shield restoration, cleanse/status immunity. |
| `officer` | Command haste aura; later damage/targeting/formation aura variants. |
| `nanite_generator` | Area regeneration, cleanse, or revive-lite. |
| `shield_emitter` | Shield aura or periodic shield pulses. |
| `radar_zepplin` | Reveal, anti-stealth, and range relay; later targeting-priority relay variants. |

### P2.5: Mechabellum-style missing counters

| Counter layer | Why it matters | Candidate units |
| --- | --- | --- |
| Projectile defense | Creates counterplay against artillery and missiles. | `shield_emitter`, `radar_zepplin`, `gatling_rover` |
| Shield breaking | Prevents guard/fortress compositions from becoming mandatory. | `shield_breaker_rounds`, `ion_crawler`, `railgun_walker`, `missile_buggy` |
| Anti-summoner | Stops War Factory-style snowball loops. | `anti_summoner_protocol`, `bounty_hunter`, `stealth_operative`, `hacker_rover` |
| Anti-stealth/reveal | Gives stealth units a real risk/reward contract. | `radar_zepplin`, `sensor_suite`, `scout_drone`, `officer` |
| Anti-giant ramping | Lets small armies answer XL anchors without universal DPS. | `ion_crawler`, `railgun_walker`, `plasma_tank` |
| Area denial | Makes approach lanes and clumps tactically dangerous. | `minelayer_rover`, `flamethrower`, `grenadier`, `siege_tank` |
| Formation disruption | Punishes dense formations without just adding more AoE damage. | `gravity_manipulator`, `sonic_devastator`, `cryo_tank` |
| Disable control | Creates windows where high-value units cannot use attacks/upgrades. | `emp_drone`, `railgun_walker`, `sonic_devastator` |
| Hack control | Gives support hunters a unique payoff beyond damage. | `hacker_rover` |
| Movement control | Lets armies kite, peel, or hold fast attackers in kill zones. | `cryo_tank`, `gravity_manipulator`, `minelayer_rover` |
| Vision/range suppression | Counters snipers and artillery without simply killing them faster. | `radar_zepplin`, `sonic_devastator`, smokeOnAction upgrades |
| Vulnerability debuff | Creates focused burst windows against anchors and giants. | `ion_crawler`, `emp_drone`, `nanite_generator` |
| Tempo pressure | Forces early reaction without becoming a universal damage carry. | `shock_trooper`, `scavenger_buggy`, `jetpack_trooper`, `scout_drone` |

### P3: Tier 1 retune

The early roster should teach clean counters:

| Unit | Keep | Reduce/limit |
| --- | --- | --- |
| `marine` | Baseline carry flexibility | DPS, with AA only through upgrades |
| `shock_trooper` | Fast screen pressure | Total DPS or durability |
| `flamethrower` | Screen Clear AoE | Air/armor relevance |
| `medic` | Utility support learning | Damage role |
| `grenadier` | Mid-range AoE | Single-target efficiency |
| `heavy_gunner` | Sustained carry/suppression | Overlap with marine and dedicated screen clear |
| `sapper` | Burst demolition | Reliability and survivability |
| `scout_drone` | Fast air scout/harassment | Generalist DPS and durability |
| `sniper` | Precision range pressure | Screen clear and AA relevance |
| `scavenger_buggy` | Charge flank tempo | Straight-line brawler reliability |
| `officer` | Command aura support | Mandatory aura stacking |
| `jetpack_trooper` | Backline/flank access | Direct melee superiority over shock troopers |

Tier 1 acceptance gates now separate hard role contracts from diagnostic
numbers. Balance passes may change exact survivors or duration, but these
contracts should stay true unless the role document is updated first:

| Gate | Scenario | Contract protected |
| --- | --- | --- |
| Suppression carry | `tier1_heavy_gunner_sustained_line` | Heavy gunner must emit visible `output_suppressed`, not only raw damage. |
| Fire screen clear | `tier1_flamethrower_vs_swarm` | Flamethrower should beat light swarm through cone/burn pressure. |
| Fire counterplay | `tier1_flamethrower_vs_armored_screen` | Flamethrower should not become a reliable armored-screen killer. |
| Demolition burst | `tier1_sapper_vs_static_guard` | Sapper should delete static fortifications through risky burst. |
| Dedicated anti-air | `tier1_scout_drone_aa_check` | Scout drones should lose to a prepared AA turret. |
| Precision support removal | `tier1_sniper_priority_target` | Sniper should remove support, not replace frontline DPS. |
| AoE anti-clump | `tier1_grenadier_vs_clump` / `tier1_grenadier_vs_spread` | Grenadier should punish clumps more quickly than spread formations. |
| Charge flank | `tier1_buggy_open_flank` | Buggy should need open approach/charge value to win cleanly. |

Tier 1 cost/value pass v3 keeps runtime outcomes stable while correcting early
economy signals: `aa_turret` is priced closer to a hard counter, `scout_drone`
is cheaper as an expendable air scout, `jetpack_trooper` pays more for clean
backline access, and `heavy_gunner` suppression is slightly softer per hit.

## Upgrade Implications

Upgrades should transform role instead of only increasing stats. Good examples to
keep and expand:

| Upgrade | Role transformation |
| --- | --- |
| `portable_shield` | Marine becomes guard-capable carry. |
| `range_enhancement` | Ranged unit shifts into range pressure posture. |
| `emp_rounds` | Marksman/heavy gunner becomes disable-control specialist counter. |
| `anti_aircraft_ammo` | Ground unit becomes emergency anti-air specialist. |
| `shield_breaker_rounds` | Railgun/plasma/missile unit becomes a specialist answer to shielded anchors. |
| `armor_piercing_rounds` | Marksman/heavy/anti-armor unit becomes a specialist answer to armored anchors without extra unarmored DPS. |
| `anti_summoner_protocol` | Assassin/marksman unit becomes a specialist answer to summoners, spawned units, and decoys. |
| `sensor_suite` | Scout/officer/hunter unit becomes a local anti-stealth detector without gaining direct DPS. |
| `thermal_optics` | Precision unit resists smoke/accuracy suppression without gaining raw clean-hit DPS. |
| `subterranean_blitz` | Screen unit gains explicit underground movement defense while advancing, then surfaces before attacking. |
| `incendiary_ammo` | Projectile unit becomes area denial/screen clear. |

Missing upgrade categories:

1. Additional shield-breaker variants and shield-bypass tradeoffs.
2. Additional anti-summoner variants with control or spawn-cap pressure.
3. Additional anti-stealth/reveal variants and reveal-break interactions.
4. Additional armor-piercing variants and drawbacks.
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
15. Additional vision/range/accuracy suppression upgrades for anti-sniper and anti-artillery play.
16. Vulnerability-debuff upgrades that enable burst without replacing anti-heavy units.
17. Cleanse/status-removal upgrades for fire, acid, smoke, and control recovery.
18. Status-immunity upgrades with narrow windows or explicit aura boundaries.
19. Flat damage block and damage-sharing upgrades for guard and anchor units.
20. Additional stance/mode transformations that alter movement, range, and targeting.
21. Target-mark upgrades for priority overrides and focus-fire control.
22. Additional burrow/underground counter variants beyond reveal.
23. Additional ramp/charge scaling upgrades for anti-giant and late-fight carry units.
24. Multi-weapon, split-fire, and chain-attack upgrade variants.
25. On-death and on-kill effects with deterministic caps.
26. Additional percent-HP damage upgrades for anti-giant roles.
27. Output-suppression upgrades that reduce attack cadence without full EMP.
28. Additional armor-break, armor-pierce, and shield-bypass upgrades.
29. Degeneration upgrades for anti-regen and anti-giant pressure.
30. Haste/rage upgrades with explicit trigger and duration rules.
31. Temporary battlefield-object upgrades: barriers, mines, wreckage, decoys.
32. Attack-geometry upgrades: beam, cone, line pierce, and barrage shapes.

## Primitive Backlog

The primitive coverage contract now lives in
`docs/combat-primitive-coverage.md`. Balance work should not start from broad
stat tuning until that contract stays green.

Current backlog:

1. Prefer explicit `triggerEffects` for new on-death spawn content; legacy
   `onDeathSpawn` is kept only as an adapter into that primitive.
2. Keep replay QA contracts green: new `BATTLE_ACTION_TYPES` entries need
   label/color coverage or explicit exemption, and `/simulator2` overlay smoke
   must keep hitboxes, velocity vectors, and target lines visible on canvas.
3. Tune conversion thresholds, cleanse counters, and multi-control penalties
   after simulator QA confirms readability.
4. Tune periodic ability payloads only after charges, intervals, target policy,
   and replay timing are stable.
5. Decide which unit configs should receive the new primitives; this document
   describes roles, while `combat.config.ts` remains the balance surface.
6. Keep split replay QA in CI: fast replay smoke covers timeline, overlays,
   and primitive labels; Windows visual baseline covers stable screenshots.
7. Keep `npm run test:combat:scenarios` green before balance tuning; it is the
   runtime gate for scenario termination, replay-visible mechanics, spawn caps,
   and soft movement metrics.
8. Regenerate `npm run combat:snapshot` before and after balance changes so
   unit outcomes, damage maps, and replay action counts stay comparable.
