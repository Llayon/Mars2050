import { describe, expect, it } from 'vitest'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { UnitRow, UnitTypeConfig, UnitTypeKey } from '@/domains/combat/combat.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { UPGRADES } from '@/domains/combat/combat.upgrades'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { applyEcsSingleDamage, createEcsMeleeEngagementState, runTargetingSystem } from '@/domains/combat/ecs/systems'

const BASELINE_ANTI_AIR_UNITS = new Set([
  'aa_turret', 'rocketeer', 'heavy_gunner', 'gatling_rover',
  'missile_buggy', 'interceptor', 'goliath_gunship',
])

function row(id: string, unitType: UnitTypeKey, upgradePath: string[] = []): UnitRow {
  return {
    id, colony_id: `${id}-colony`, unit_type: unitType, hp_current: 1000,
    grid_x: '120', grid_y: '120', tier: 1, upgrade_path: upgradePath,
  }
}

describe('combat ECS anti-air contract', () => {
  it('limits baseline anti-air to the explicit roster', () => {
    for (const [unitType, config] of Object.entries(UNIT_TYPES) as [string, UnitTypeConfig][]) {
      expect(config.baseStats.canTargetAir === true, unitType)
        .toBe(BASELINE_ANTI_AIR_UNITS.has(unitType))
      if (config.baseStats.targetingProfile === 'anti_air') {
        expect(config.baseStats.canTargetAir, unitType).toBe(true)
      }
    }
  })

  it('keeps upgrade-based anti-air explicit', () => {
    expect(UPGRADES.aerial_specialization.modifiers).toMatchObject({
      grantAntiAir: true,
      antiAirDamageMult: expect.any(Number),
    })
    expect(UPGRADES.anti_aircraft_ammo.modifiers.grantAntiAir).toBe(true)
    for (const unitType of UPGRADES.anti_aircraft_ammo.allowedUnits) {
      expect(UNIT_TYPES[unitType as UnitTypeKey].baseStats.canTargetAir, unitType)
        .not.toBe(true)
    }
  })

  it('acquires ground targets without allowing a non-AA fallback to aircraft', () => {
    const marine = createRuntimeUnitFromConfig({
      id: 'marine', team: 'attacker', type: 'marine', x: 0, y: 0, currentAngle: 0,
    })!
    const aircraft = createRuntimeUnitFromConfig({
      id: 'aircraft', team: 'defender', type: 'gunship', x: 80, y: 0,
      currentAngle: Math.PI,
    })!
    const ground = createRuntimeUnitFromConfig({
      id: 'ground', team: 'defender', type: 'marine', x: 220, y: 0,
      currentAngle: Math.PI,
    })!
    const runtime = createEcsCombatRuntime()
    runtime.world.queueUnitCreation(marine, aircraft, ground)
    runtime.flushStructuralCommands()
    runtime.world.resources.require('entitySpatial').ensureCurrent(runtime.world)

    expect(runTargetingSystem(runtime.world, 0, createEcsMeleeEngagementState())).toBe(2)

    runtime.world.stores.vitality.require(2).isDead = true
    expect(runTargetingSystem(runtime.world, 0, createEcsMeleeEngagementState())).toBeNull()
  })

  it('applies anti-air damage multipliers only to flying targets', () => {
    const attacker = createRuntimeUnitFromConfig({
      id: 'sniper', team: 'attacker', type: 'sniper', x: 0, y: 0, currentAngle: 0,
    })!
    const aircraft = createRuntimeUnitFromConfig({
      id: 'aircraft', team: 'defender', type: 'gunship', x: 80, y: 0,
      currentAngle: Math.PI,
    })!
    const ground = createRuntimeUnitFromConfig({
      id: 'ground', team: 'defender', type: 'marine', x: 80, y: 0,
      currentAngle: Math.PI,
    })!
    const world = new CombatWorld([attacker, aircraft, ground])
    world.stores.combat.require(0).antiAirDamageMult = 1.9
    world.stores.combat.require(1).defense = 0
    world.stores.combat.require(2).defense = 0

    expect(applyEcsSingleDamage(world, 0, 1, 100, []).damage).toBe(190)
    expect(applyEcsSingleDamage(world, 0, 2, 100, []).damage).toBe(100)
  })

  it('maps anti-air upgrades through the engine boundary', () => {
    const result = simulateBattle(
      [
        row('marine-row', 'marine', ['anti_aircraft_ammo']),
        row('sniper-row', 'sniper', ['aerial_specialization']),
      ],
      [row('gunship-row', 'gunship')],
      12,
      [],
    )
    const marine = result.initialState.find(unit => unit.id.startsWith('marine-row'))
    const sniper = result.initialState.find(unit => unit.id.startsWith('sniper-row'))

    expect(marine?.canTargetAir).toBe(true)
    expect(sniper).toMatchObject({ canTargetAir: true, antiAirDamageMult: 1.9 })
  })
})
