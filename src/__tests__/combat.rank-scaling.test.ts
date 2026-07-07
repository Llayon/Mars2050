import { describe, expect, it } from 'vitest'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { applyCombatDamage } from '@/domains/combat/combat.damage'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { SimUnit, Team, UnitRow } from '@/domains/combat/combat.types'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team }): SimUnit {
  return {
    type: 'marine',
    rank: 1,
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

describe('combat rank scaling', () => {
  it('copies UnitRow tier into squad members and scales starting stats', () => {
    const original = UNIT_TYPES.turret.baseStats.rankScaling
    UNIT_TYPES.turret.baseStats.rankScaling = { hpMultPerRank: 0.1, attackMultPerRank: 0.5, defenseAddPerRank: 2, rangeAddPerRank: 20, cooldownReductionPerRank: 0.1 }
    try {
      const attacker: UnitRow = { id: 'ranked', colony_id: 'a', unit_type: 'turret', hp_current: 999, grid_x: '100', grid_y: '1000', tier: 3, upgrade_path: [] }
      const defender: UnitRow = { id: 'wall', colony_id: 'd', unit_type: 'wall', hp_current: 500, grid_x: '100', grid_y: '100', tier: 1, upgrade_path: [] }

      const result = simulateBattle([attacker], [defender], 11, [])
      const unit = result.initialState.find(initial => initial.id === 'ranked')

      expect(unit).toMatchObject({ rank: 3, maxHp: 240, attack: 40, defense: 9, range: 280, actionCooldownMax: 4 })
    } finally {
      UNIT_TYPES.turret.baseStats.rankScaling = original
    }
  })

  it('applies rank-conditional damage modifiers only when relation matches', () => {
    const attacker = makeUnit({ id: 'elite', team: 'attacker', rank: 3, attack: 20, rankScaling: { damageModifiers: [{ relation: 'same_rank', multiplier: 2 }] } })
    const sameRank = makeUnit({ id: 'same', team: 'defender', rank: 3 })
    const lowerRank = makeUnit({ id: 'lower', team: 'defender', rank: 1 })

    expect(applyCombatDamage(attacker, sameRank, attacker.attack).damage).toBe(40)
    expect(applyCombatDamage(attacker, lowerRank, attacker.attack).damage).toBe(20)
  })
})
