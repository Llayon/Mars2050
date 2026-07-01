import { describe, expect, it } from 'vitest'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { applyCombatDamage } from '@/domains/combat/combat.damage'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { getBeamTargets } from '@/domains/combat/combat.attack-geometry'
import { getSideWeaponTargets } from '@/domains/combat/combat.side-weapon'
import { getSplitFireTargets } from '@/domains/combat/combat.split-fire'
import { createMeleeEngagementState } from '@/domains/combat/combat.melee-engagement'
import { targetingSystem } from '@/domains/combat/combat.targeting'
import { UPGRADES } from '@/domains/combat/combat.upgrades'
import { SpatialHash } from '@/domains/combat/spatial-hash'
import type { SimUnit, Team, UnitRow, UnitTypeConfig, UnitTypeKey } from '@/domains/combat/combat.types'

const BASELINE_ANTI_AIR_UNITS = new Set([
  'aa_turret',
  'rocketeer',
  'gatling_rover',
  'missile_buggy',
  'interceptor',
  'goliath_gunship',
])

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team; x: number; y: number; type?: string }): SimUnit {
  return {
    type: 'marine',
    hp: 100,
    maxHp: 100,
    attack: 10,
    defense: 0,
    speed: 10,
    range: 240,
    attackType: 'single',
    actionCooldownMax: 10,
    actionCooldown: 0,
    isFlying: false,
    canTargetAir: false,
    isDead: false,
    turnSpeed: 1,
    currentAngle: 0,
    size: 'S',
    shield: 0,
    maxShield: 0,
    statusEffects: [],
    aggroLockTicks: 0,
    velocity: { x: 0, y: 0 },
    ...overrides,
  }
}

function makeHash(units: SimUnit[]): SpatialHash {
  const hash = new SpatialHash(40)
  units.forEach(unit => hash.insert(unit))
  return hash
}

function makeUnitRow(id: string, unitType: UnitTypeKey, upgradePath: string[] = []): UnitRow {
  return {
    id,
    colony_id: `${id}-colony`,
    unit_type: unitType,
    hp_current: 1000,
    grid_x: '120',
    grid_y: '120',
    tier: 1,
    upgrade_path: upgradePath,
  }
}

describe('combat anti-air contract', () => {
  it('keeps baseline anti-air targeting limited to dedicated units', () => {
    for (const [unitType, config] of Object.entries(UNIT_TYPES) as [string, UnitTypeConfig][]) {
      const hasBaselineAntiAir = config.baseStats.canTargetAir === true

      if (BASELINE_ANTI_AIR_UNITS.has(unitType)) {
        expect(hasBaselineAntiAir, `${unitType} should keep baseline anti-air`).toBe(true)
      } else {
        expect(hasBaselineAntiAir, `${unitType} has baseline anti-air outside the dedicated list`).toBe(false)
      }
    }
  })

  it('does not allow anti-air targeting profiles without air targeting capability', () => {
    for (const [unitType, config] of Object.entries(UNIT_TYPES) as [string, UnitTypeConfig][]) {
      if (config.baseStats.targetingProfile !== 'anti_air') continue

      expect(config.baseStats.canTargetAir, `${unitType} uses anti_air profile without canTargetAir`).toBe(true)
    }
  })

  it('keeps upgrade-based anti-air explicit', () => {
    expect(UPGRADES.aerial_specialization.modifiers.grantAntiAir).toBe(true)
    expect(UPGRADES.aerial_specialization.modifiers.antiAirDamageMult).toBeGreaterThan(1)
    expect(UPGRADES.anti_aircraft_ammo.modifiers).toMatchObject({ grantAntiAir: true })

    for (const unitType of UPGRADES.anti_aircraft_ammo.allowedUnits) {
      expect(UNIT_TYPES[unitType as keyof typeof UNIT_TYPES]?.baseStats.canTargetAir, `${unitType} should use upgrade-based anti-air`).not.toBe(true)
    }
  })

  it('prevents ordinary ground units from acquiring aircraft targets', () => {
    const marine = makeUnit({ id: 'marine', team: 'attacker', type: 'marine', x: 0, y: 0 })
    const aircraft = makeUnit({ id: 'aircraft', team: 'defender', type: 'gunship', x: 80, y: 0, isFlying: true })
    const ground = makeUnit({ id: 'ground', team: 'defender', type: 'marine', x: 220, y: 0 })
    const units = [marine, aircraft, ground]

    const target = targetingSystem(marine, units, createMeleeEngagementState(), makeHash(units))

    expect(target?.id).toBe('ground')
  })

  it('leaves non-AA units without a fallback target when only aircraft are present', () => {
    const marine = makeUnit({ id: 'marine', team: 'attacker', type: 'marine', x: 0, y: 0 })
    const aircraft = makeUnit({ id: 'aircraft', team: 'defender', type: 'gunship', x: 80, y: 0, isFlying: true })
    const units = [marine, aircraft]

    const target = targetingSystem(marine, units, createMeleeEngagementState(), makeHash(units))

    expect(target).toBeNull()
    expect(marine.attackTargetId).toBeUndefined()
  })

  it('applies anti-air capability and damage multipliers through upgrades', () => {
    const result = simulateBattle(
      [
        makeUnitRow('marine-row', 'marine', ['anti_aircraft_ammo']),
        makeUnitRow('sniper-row', 'sniper', ['aerial_specialization']),
      ],
      [makeUnitRow('gunship-row', 'gunship')],
      12,
      []
    )
    const upgradedMarine = result.initialState.find(unit => unit.id.startsWith('marine-row'))
    const upgradedSniper = result.initialState.find(unit => unit.id.startsWith('sniper-row'))

    expect(upgradedMarine?.canTargetAir).toBe(true)
    expect(upgradedSniper?.canTargetAir).toBe(true)
    expect(upgradedSniper?.antiAirDamageMult).toBe(1.9)
  })

  it('applies anti-air damage multipliers only against flying targets', () => {
    const attacker = makeUnit({ id: 'sniper', team: 'attacker', type: 'sniper', x: 0, y: 0, attack: 100, canTargetAir: true, antiAirDamageMult: 1.9 })
    const aircraft = makeUnit({ id: 'aircraft', team: 'defender', type: 'gunship', x: 80, y: 0, isFlying: true })
    const ground = makeUnit({ id: 'ground', team: 'defender', type: 'marine', x: 80, y: 0 })

    expect(applyCombatDamage(attacker, aircraft, attacker.attack).damage).toBe(190)
    expect(applyCombatDamage(attacker, ground, attacker.attack).damage).toBe(100)
  })

  it('keeps shaped secondary weapons bound to anti-air capability', () => {
    const attacker = makeUnit({ id: 'ion', team: 'attacker', type: 'ion_crawler', x: 0, y: 0, range: 240 })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 100, y: 0 })
    const aircraft = makeUnit({ id: 'aircraft', team: 'defender', type: 'gunship', x: 160, y: 10, isFlying: true })

    expect(getBeamTargets(attacker, primary, [attacker, primary, aircraft])).toEqual([])
    expect(getBeamTargets({ ...attacker, canTargetAir: true }, primary, [attacker, primary, aircraft]).map(unit => unit.id)).toEqual(['aircraft'])
  })

  it('keeps split-fire and side weapons from bypassing anti-air rules', () => {
    const splitConfig = UNIT_TYPES.gatling_rover.baseStats.splitFire
    const sideConfig = UNIT_TYPES.goliath_gunship.baseStats.sideWeapon
    const previousSplitCanTargetAir = splitConfig?.canTargetAir
    const previousSideCanTargetAir = sideConfig?.canTargetAir

    try {
      if (!splitConfig || !sideConfig) throw new Error('Missing anti-air weapon configs')

      splitConfig.canTargetAir = false
      sideConfig.canTargetAir = false

      const groundPrimary = makeUnit({ id: 'primary', team: 'defender', x: 100, y: 0 })
      const aircraft = makeUnit({ id: 'aircraft', team: 'defender', type: 'gunship', x: 80, y: 0, isFlying: true })
      const gatling = makeUnit({ id: 'gatling', team: 'attacker', type: 'gatling_rover', x: 0, y: 0, range: 160 })
      const goliath = makeUnit({ id: 'goliath', team: 'attacker', type: 'goliath_gunship', x: 0, y: 0, range: 240, isFlying: true })

      expect(getSplitFireTargets(gatling, groundPrimary, [gatling, groundPrimary, aircraft])).toEqual([])
      expect(getSideWeaponTargets(goliath, groundPrimary, [goliath, groundPrimary, aircraft])).toEqual([])
      expect(getSplitFireTargets({ ...gatling, canTargetAir: true }, groundPrimary, [gatling, groundPrimary, aircraft]).map(unit => unit.id)).toEqual(['aircraft'])
      expect(getSideWeaponTargets({ ...goliath, canTargetAir: true }, groundPrimary, [goliath, groundPrimary, aircraft]).map(unit => unit.id)).toEqual(['aircraft'])
    } finally {
      if (splitConfig) {
        if (previousSplitCanTargetAir === undefined) delete splitConfig.canTargetAir
        else splitConfig.canTargetAir = previousSplitCanTargetAir
      }
      if (sideConfig) {
        if (previousSideCanTargetAir === undefined) delete sideConfig.canTargetAir
        else sideConfig.canTargetAir = previousSideCanTargetAir
      }
    }
  })
})
