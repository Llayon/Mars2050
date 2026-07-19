import { describe, expect, it } from 'vitest'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { UnitRow } from '@/domains/combat/combat.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { applyEcsSingleDamage } from '@/domains/combat/ecs/systems'

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
    const attacker = createRuntimeUnitFromConfig({
      id: 'elite', team: 'attacker', type: 'marine', x: 0, y: 0, currentAngle: 0,
    })!
    const sameRank = createRuntimeUnitFromConfig({
      id: 'same', team: 'defender', type: 'marine', x: 0, y: 0, currentAngle: Math.PI,
    })!
    const lowerRank = createRuntimeUnitFromConfig({
      id: 'lower', team: 'defender', type: 'marine', x: 0, y: 0, currentAngle: Math.PI,
    })!
    Object.assign(attacker, {
      rank: 3,
      attack: 20,
      rankScaling: { damageModifiers: [{ relation: 'same_rank', multiplier: 2 }] },
    })
    sameRank.rank = 3
    lowerRank.rank = 1
    const world = new CombatWorld([attacker, sameRank, lowerRank])
    world.stores.combat.require(1).defense = 0
    world.stores.combat.require(2).defense = 0

    expect(applyEcsSingleDamage(world, 0, 1, attacker.attack, []).damage).toBe(40)
    expect(applyEcsSingleDamage(world, 0, 2, attacker.attack, []).damage).toBe(20)
  })
})
