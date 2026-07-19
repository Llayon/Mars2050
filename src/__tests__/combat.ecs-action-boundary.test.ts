import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { runActionSystem } from '@/domains/combat/ecs/systems'

describe('combat ECS action boundary', () => {
  it('uses canonical attack and hacked target state without a legacy fallback', () => {
    const attacker = createRuntimeUnitFromConfig({
      id: 'attacker', team: 'attacker', type: 'marine',
      x: 100, y: 100, currentAngle: 0,
    })!
    const target = createRuntimeUnitFromConfig({
      id: 'target', team: 'defender', type: 'marine',
      x: 180, y: 100, currentAngle: Math.PI,
    })!
    target.statusEffects.push({
      type: 'hacked',
      duration: 10,
      controlMode: 'redirect',
      tickInterval: 0,
      nextTickIn: 0,
    })
    const world = new CombatWorld([attacker, target])
    const entitySpatial = new EntitySpatialIndex()
    entitySpatial.rebuild(world)
    world.resources.set('entitySpatial', entitySpatial)
    const canonicalAttack = world.stores.combat.require(0).attack
    const actions: BattleAction[] = []

    attacker.attack = 10_000
    target.statusEffects = []

    const result = runActionSystem(world, 0, 1, actions, {
      rng: new PRNG(149),
      tick: 0,
    })

    expect(result).toEqual({ acted: true, actorSynchronized: true })
    expect(world.stores.combat.require(0).attack).toBe(canonicalAttack)
    expect(world.stores.statusControl.require(1).statusEffects)
      .toContainEqual(expect.objectContaining({ type: 'hacked', controlMode: 'redirect' }))
    expect(actions).toContainEqual(expect.objectContaining({
      unitId: 'attacker',
      type: 'damage',
      targetId: 'target',
      damage: canonicalAttack - target.defense,
    }))
  })

  it('blocks EMP from canonical status state', () => {
    const attacker = createRuntimeUnitFromConfig({
      id: 'emp-attacker', team: 'attacker', type: 'marine',
      x: 100, y: 100, currentAngle: 0,
    })!
    const target = createRuntimeUnitFromConfig({
      id: 'emp-target', team: 'defender', type: 'marine',
      x: 180, y: 100, currentAngle: Math.PI,
    })!
    attacker.statusEffects.push({
      type: 'emp',
      duration: 10,
      tickInterval: 0,
      nextTickIn: 0,
    })
    const world = new CombatWorld([attacker, target])
    attacker.statusEffects = []

    const result = runActionSystem(world, 0, 1, [], {
      rng: new PRNG(151),
      tick: 0,
    })

    expect(result).toEqual({ acted: false, actorSynchronized: false })
    expect(world.stores.vitality.require(1).hp).toBe(target.maxHp)
  })
})
