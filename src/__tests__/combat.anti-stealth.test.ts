import { describe, expect, it } from 'vitest'
import { getUnitSupportAuras, processSupportAuras } from '@/domains/combat/combat.auras'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { createMeleeEngagementState } from '@/domains/combat/combat.melee-engagement'
import { hasStatus } from '@/domains/combat/combat.status'
import { targetingSystem } from '@/domains/combat/combat.targeting'
import type { SimUnit, Team, UnitRow } from '@/domains/combat/combat.types'
import { SpatialHash } from '@/domains/combat/spatial-hash'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team }): SimUnit {
  return {
    type: 'marine',
    hp: 100,
    maxHp: 100,
    attack: 10,
    defense: 0,
    speed: 10,
    range: 120,
    attackType: 'single',
    actionCooldownMax: 10,
    actionCooldown: 0,
    isFlying: false,
    canTargetAir: false,
    x: 0,
    y: 0,
    isDead: false,
    turnSpeed: 10,
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

describe('combat anti-stealth reveal', () => {
  it('uses sensor-suite aura to reveal stealth targets before targeting', () => {
    const scanner = makeUnit({
      id: 'scanner',
      team: 'attacker',
      type: 'officer',
      supportAuras: getUnitSupportAuras(undefined, ['sensor_suite']),
    })
    const shooter = makeUnit({ id: 'shooter', team: 'attacker' })
    const stealth = makeUnit({ id: 'stealth', team: 'defender', type: 'stealth_operative', x: 100, stealthUntilAttack: true })
    const normal = makeUnit({ id: 'normal', team: 'defender', type: 'marine', x: 120 })
    const units = [scanner, shooter, stealth, normal]

    expect(targetingSystem(shooter, units, createMeleeEngagementState(), makeHash(units))?.id).toBe('normal')
    shooter.attackTargetId = undefined
    shooter.aggroLockTicks = 0
    processSupportAuras(0, units, [])

    const target = targetingSystem(shooter, units, createMeleeEngagementState(), makeHash(units))

    expect(hasStatus(stealth, 'revealed')).toBe(true)
    expect(hasStatus(normal, 'revealed')).toBe(false)
    expect(target?.id).toBe('stealth')
  })

  it('maps sensor suite upgrades into runtime support auras', () => {
    const attackers: UnitRow[] = [{ id: 'officer', colony_id: 'a', unit_type: 'officer', hp_current: 80, grid_x: '100', grid_y: '500', tier: 1, upgrade_path: ['sensor_suite'] }]
    const defenders: UnitRow[] = [{ id: 'ghost', colony_id: 'd', unit_type: 'stealth_operative', hp_current: 100, grid_x: '100', grid_y: '100', tier: 1, upgrade_path: [] }]

    const result = simulateBattle(attackers, defenders, 29, [])
    const officer = result.initialState.find(unit => unit.id === 'officer')

    expect(officer?.supportAuras).toContainEqual({ type: 'reveal', radius: 220, value: 0, duration: 12, interval: 5, target: 'enemies', targetTags: ['stealth'] })
    expect(officer?.supportAuras?.some(aura => aura.type === 'haste')).toBe(true)
  })
})
