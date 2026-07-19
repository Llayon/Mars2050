import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { applyEcsSingleDamage } from '@/domains/combat/ecs/systems'

function createWorld(): CombatWorld {
  const attacker = createRuntimeUnitFromConfig({
    id: 'attacker', team: 'attacker', type: 'marine', x: 0, y: 0, currentAngle: 0,
  })!
  const target = createRuntimeUnitFromConfig({
    id: 'armor', team: 'defender', type: 'marine', x: 0, y: 0, currentAngle: Math.PI,
  })!
  const world = new CombatWorld([attacker, target])
  world.stores.combat.require(1).defense = 0
  Object.assign(world.stores.vitality.require(1), { hp: 100, maxHp: 100 })
  return world
}

describe('flat block armor primitive', () => {
  it('reduces every hit with rank scaling and emits blocked replay damage', () => {
    const world = createWorld()
    world.stores.identity.require(1).rank = 3
    world.stores.defense.require(1).flatDamageBlock = { amount: 8, perRank: 4 }
    const actions: BattleAction[] = []

    const first = applyEcsSingleDamage(world, 0, 1, 50, actions)
    const second = applyEcsSingleDamage(world, 0, 1, 50, actions)

    expect(first.damage).toBe(34)
    expect(second.damage).toBe(34)
    expect(world.stores.vitality.require(1).hp).toBe(32)
    expect(actions.filter(action => action.type === 'unit_blocked_damage')).toEqual([
      { unitId: 'armor', type: 'unit_blocked_damage', targetId: 'attacker', damage: 16 },
      { unitId: 'armor', type: 'unit_blocked_damage', targetId: 'attacker', damage: 16 },
    ])
  })

  it('respects minimum damage when flat block exceeds incoming damage', () => {
    const world = createWorld()
    world.stores.defense.require(1).flatDamageBlock = { amount: 50, minimumDamage: 3 }

    const result = applyEcsSingleDamage(world, 0, 1, 12, [])

    expect(result.damage).toBe(3)
    expect(world.stores.vitality.require(1).hp).toBe(97)
  })
})
