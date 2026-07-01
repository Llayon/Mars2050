import { describe, expect, it } from 'vitest'
import { applyCombatDamage } from '@/domains/combat/combat.damage'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { applyStatus } from '@/domains/combat/combat.status'
import type { SimUnit, Team, UnitRow } from '@/domains/combat/combat.types'

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

describe('combat accuracy suppression', () => {
  it('converts accuracy reduction into deterministic glancing damage', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 50 })
    const target = makeUnit({ id: 'target', team: 'defender' })
    applyStatus(attacker, { type: 'accuracy_reduced', duration: 5, value: 0.4 })

    const result = applyCombatDamage(attacker, target, attacker.attack)

    expect(result.damage).toBe(30)
    expect(target.hp).toBe(70)
  })

  it('lets thermal optics resist accuracy penalties without changing clean hits', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 50, accuracyPenaltyResist: 0.6 })
    const target = makeUnit({ id: 'target', team: 'defender' })
    applyStatus(attacker, { type: 'accuracy_reduced', duration: 5, value: 0.5 })

    const result = applyCombatDamage(attacker, target, attacker.attack)

    expect(result.damage).toBe(40)
    expect(target.hp).toBe(60)
  })

  it('maps thermal optics upgrades into runtime units', () => {
    const attackers: UnitRow[] = [{ id: 'sniper', colony_id: 'a', unit_type: 'sniper', hp_current: 30, grid_x: '100', grid_y: '500', tier: 1, upgrade_path: ['thermal_optics'] }]
    const defenders: UnitRow[] = [{ id: 'wall', colony_id: 'd', unit_type: 'wall', hp_current: 500, grid_x: '100', grid_y: '100', tier: 1, upgrade_path: [] }]

    const result = simulateBattle(attackers, defenders, 31, [])
    const sniper = result.initialState.find(unit => unit.id === 'sniper_0')

    expect(sniper?.accuracyPenaltyResist).toBe(0.6)
    expect(sniper?.attack).toBe(60)
  })
})
