import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { UnitRow } from '@/domains/combat/combat.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { applyEcsSingleDamage } from '@/domains/combat/ecs/systems'

function createWorld(): CombatWorld {
  const attacker = createRuntimeUnitFromConfig({
    id: 'attacker', team: 'attacker', type: 'marine', x: 0, y: 0, currentAngle: 0,
  })!
  const shielded = createRuntimeUnitFromConfig({
    id: 'shielded', team: 'defender', type: 'marine', x: 0, y: 0, currentAngle: Math.PI,
  })!
  const unshielded = createRuntimeUnitFromConfig({
    id: 'unshielded', team: 'defender', type: 'marine', x: 0, y: 0, currentAngle: Math.PI,
  })!
  const world = new CombatWorld([attacker, shielded, unshielded])
  world.stores.combat.require(0).shieldDamageMult = 2
  for (const targetId of [1, 2]) {
    world.stores.combat.require(targetId).defense = 0
    Object.assign(world.stores.vitality.require(targetId), { hp: 100, maxHp: 100 })
  }
  return world
}

describe('combat shield breaker', () => {
  it('amplifies shield damage without multiplying unshielded HP damage', () => {
    const world = createWorld()
    Object.assign(world.stores.vitality.require(1), { shield: 60, maxShield: 60 })
    const actions: BattleAction[] = []

    const shieldedResult = applyEcsSingleDamage(world, 0, 1, 40, actions)
    const unshieldedResult = applyEcsSingleDamage(world, 0, 2, 40, [])

    expect(shieldedResult).toMatchObject({ damage: 10, shieldDamage: 60, shieldBroken: true })
    expect(world.stores.vitality.require(1).hp).toBe(90)
    expect(unshieldedResult.damage).toBe(40)
    expect(world.stores.vitality.require(2).hp).toBe(60)
    expect(actions).toEqual([
      { unitId: 'attacker', type: 'shield_damage', targetId: 'shielded', damage: 60, isShieldHit: true },
      { unitId: 'attacker', type: 'shield_break', targetId: 'shielded' },
      { unitId: 'attacker', type: 'damage', targetId: 'shielded', damage: 10 },
    ])
  })

  it('spends shield breaker damage into shield HP before HP overflow', () => {
    const world = createWorld()
    Object.assign(world.stores.vitality.require(1), { shield: 100, maxShield: 100 })

    const result = applyEcsSingleDamage(world, 0, 1, 40, [])

    expect(result).toMatchObject({ damage: 0, shieldDamage: 80, shieldBroken: false })
    expect(world.stores.vitality.require(1)).toMatchObject({ hp: 100, shield: 20 })
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
