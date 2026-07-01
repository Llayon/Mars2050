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

describe('combat armor pierce', () => {
  it('reduces target defense for the attacker hit without applying a status', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 50, armorPierceRatio: 0.5 })
    const target = makeUnit({ id: 'target', team: 'defender', defense: 20 })

    const result = applyCombatDamage(attacker, target, attacker.attack)

    expect(result.damage).toBe(40)
    expect(target.hp).toBe(60)
    expect(target.statusEffects).toEqual([])
  })

  it('does not increase damage against unarmored targets', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 50, armorPierceRatio: 0.5 })
    const target = makeUnit({ id: 'target', team: 'defender', defense: 0 })

    const result = applyCombatDamage(attacker, target, attacker.attack)

    expect(result.damage).toBe(50)
    expect(target.hp).toBe(50)
  })

  it('stacks after armor broken reduces the target defense pool', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 50, armorPierceRatio: 0.5 })
    const target = makeUnit({ id: 'target', team: 'defender', defense: 20 })
    applyStatus(target, { type: 'armor_broken', duration: 5, value: 0.5 })

    const result = applyCombatDamage(attacker, target, attacker.attack)

    expect(result.damage).toBe(45)
    expect(target.hp).toBe(55)
  })

  it('maps armor-piercing upgrades into runtime units', () => {
    const attackers: UnitRow[] = [{ id: 'rail', colony_id: 'a', unit_type: 'railgun_walker', hp_current: 250, grid_x: '100', grid_y: '500', tier: 1, upgrade_path: ['armor_piercing_rounds'] }]
    const defenders: UnitRow[] = [{ id: 'wall', colony_id: 'd', unit_type: 'wall', hp_current: 500, grid_x: '100', grid_y: '100', tier: 1, upgrade_path: [] }]

    const result = simulateBattle(attackers, defenders, 17, [])
    const rail = result.initialState.find(unit => unit.id === 'rail')

    expect(rail?.armorPierceRatio).toBe(0.5)
    expect(rail?.attack).toBe(108)
  })
})
