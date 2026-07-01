import { describe, expect, it } from 'vitest'
import { applyCombatDamage } from '@/domains/combat/combat.damage'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { getEffectiveCombatTags } from '@/domains/combat/combat.targeting-score'
import type { SimUnit, Team, UnitRow } from '@/domains/combat/combat.types'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team }): SimUnit {
  return {
    type: 'marine',
    hp: 200,
    maxHp: 200,
    attack: 40,
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
    size: 'M',
    shield: 0,
    maxShield: 0,
    statusEffects: [],
    aggroLockTicks: 0,
    velocity: { x: 0, y: 0 },
    ...overrides,
  }
}

describe('combat anti-summoner counter', () => {
  it('amplifies damage against summoner units without applying a status', () => {
    const attacker = makeUnit({ id: 'hunter', team: 'attacker', summonCounterDamageMult: 1.75 })
    const target = makeUnit({ id: 'factory', team: 'defender', type: 'mobile_factory', attackType: 'spawn' })

    const result = applyCombatDamage(attacker, target, attacker.attack)

    expect(result.damage).toBe(70)
    expect(target.hp).toBe(130)
    expect(target.statusEffects).toEqual([])
  })

  it('does not increase damage against normal units', () => {
    const attacker = makeUnit({ id: 'hunter', team: 'attacker', summonCounterDamageMult: 1.75 })
    const target = makeUnit({ id: 'marine', team: 'defender' })

    const result = applyCombatDamage(attacker, target, attacker.attack)

    expect(result.damage).toBe(40)
    expect(target.hp).toBe(160)
  })

  it('amplifies damage against summoned or temporary units', () => {
    const attacker = makeUnit({ id: 'hunter', team: 'attacker', summonCounterDamageMult: 1.75 })
    const summoned = makeUnit({ id: 'summoned', team: 'defender', summonOwnerId: 'factory' })
    const temporary = makeUnit({ id: 'temporary', team: 'defender', isTemporary: true })

    expect(applyCombatDamage(attacker, summoned, attacker.attack).damage).toBe(70)
    expect(applyCombatDamage(attacker, temporary, attacker.attack).damage).toBe(70)
  })

  it('exposes summoned units as targeting tags', () => {
    const summoned = makeUnit({ id: 'summoned', team: 'defender', summonOwnerId: 'factory' })

    expect(getEffectiveCombatTags(summoned)).toContain('summoned')
  })

  it('maps anti-summoner upgrades into runtime units', () => {
    const attackers: UnitRow[] = [{ id: 'hunter', colony_id: 'a', unit_type: 'bounty_hunter', hp_current: 120, grid_x: '100', grid_y: '500', tier: 1, upgrade_path: ['anti_summoner_protocol'] }]
    const defenders: UnitRow[] = [{ id: 'factory', colony_id: 'd', unit_type: 'mobile_factory', hp_current: 900, grid_x: '100', grid_y: '100', tier: 1, upgrade_path: [] }]

    const result = simulateBattle(attackers, defenders, 23, [])
    const hunter = result.initialState.find(unit => unit.id === 'hunter')

    expect(hunter?.summonCounterDamageMult).toBe(1.75)
    expect(hunter?.attack).toBe(72)
  })
})
