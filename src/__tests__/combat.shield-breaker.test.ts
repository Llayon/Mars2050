import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { applyCombatDamage } from '@/domains/combat/combat.damage'
import { simulateBattle } from '@/domains/combat/combat.engine'
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

describe('combat shield breaker', () => {
  it('amplifies shield damage without multiplying unshielded HP damage', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 40, shieldDamageMult: 2 })
    const shielded = makeUnit({ id: 'shielded', team: 'defender', shield: 60, maxShield: 60 })
    const unshielded = makeUnit({ id: 'unshielded', team: 'defender' })
    const actions: BattleAction[] = []

    const shieldedResult = applyCombatDamage(attacker, shielded, attacker.attack, actions)
    const unshieldedResult = applyCombatDamage(attacker, unshielded, attacker.attack)

    expect(shieldedResult).toMatchObject({ damage: 10, shieldDamage: 60, shieldBroken: true })
    expect(shielded.hp).toBe(90)
    expect(unshieldedResult.damage).toBe(40)
    expect(unshielded.hp).toBe(60)
    expect(actions).toEqual([
      { unitId: 'attacker', type: 'shield_damage', targetId: 'shielded', damage: 60, isShieldHit: true },
      { unitId: 'attacker', type: 'shield_break', targetId: 'shielded' },
      { unitId: 'attacker', type: 'damage', targetId: 'shielded', damage: 10 },
    ])
  })

  it('spends shield breaker damage into shield HP before HP overflow', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 40, shieldDamageMult: 2 })
    const target = makeUnit({ id: 'target', team: 'defender', shield: 100, maxShield: 100 })

    const result = applyCombatDamage(attacker, target, attacker.attack)

    expect(result).toMatchObject({ damage: 0, shieldDamage: 80, shieldBroken: false })
    expect(target.hp).toBe(100)
    expect(target.shield).toBe(20)
  })

  it('maps shield breaker upgrades into runtime units', () => {
    const attackers: UnitRow[] = [{ id: 'rail', colony_id: 'a', unit_type: 'railgun_walker', hp_current: 250, grid_x: '100', grid_y: '500', tier: 1, upgrade_path: ['shield_breaker_rounds'] }]
    const defenders: UnitRow[] = [{ id: 'wall', colony_id: 'd', unit_type: 'wall', hp_current: 500, grid_x: '100', grid_y: '100', tier: 1, upgrade_path: [] }]

    const result = simulateBattle(attackers, defenders, 11, [])
    const rail = result.initialState.find(unit => unit.id === 'rail')

    expect(rail?.shieldDamageMult).toBe(2.25)
    expect(rail?.attack).toBe(108)
  })
})
