import { describe, expect, it } from 'vitest'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { runActionSystem } from '@/domains/combat/ecs/systems'

function unit(
  id: string,
  team: 'attacker' | 'defender',
  type: string,
  x: number,
  y: number,
  angle: number,
): SimUnit {
  return createRuntimeUnitFromConfig({ id, team, type, x, y, currentAngle: angle })!
}

function createWorld(units: SimUnit[]): CombatWorld {
  const world = new CombatWorld(units)
  const entitySpatial = new EntitySpatialIndex()
  entitySpatial.rebuild(world)
  world.resources.set('entitySpatial', entitySpatial)
  return world
}

function actionContext() {
  return { rng: new PRNG(1), tick: 0 }
}

describe('combat ECS chain attack', () => {
  it('applies jump order, falloff damage, and replay actions', () => {
    const units = [
      unit('plasma', 'attacker', 'plasma_tank', 10, 20, 0),
      unit('primary', 'defender', 'marine', 100, 20, Math.PI),
      unit('b-target', 'defender', 'marine', 150, 40, Math.PI),
      unit('a-target', 'defender', 'marine', 150, 0, Math.PI),
      unit('outside', 'defender', 'marine', 300, 20, Math.PI),
    ]
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld(units)

    const nativeResult = runActionSystem(world, 0, 1, nativeActions, actionContext())

    expect(nativeResult).toEqual({ acted: true, actorSynchronized: true })
    for (const entityId of [1, 2, 3]) {
      expect(world.stores.vitality.require(entityId).hp)
        .toBeLessThan(world.stores.vitality.require(entityId).maxHp)
    }
    expect(nativeActions.filter(action => action.type === 'chain_jump')).toEqual([
      { unitId: 'plasma', type: 'chain_jump', targetId: 'a-target', value: 1 },
      { unitId: 'plasma', type: 'chain_jump', targetId: 'b-target', value: 2 },
    ])
  })

  it('skips air targets when the primary weapon cannot target air', () => {
    const units = [
      unit('plasma', 'attacker', 'plasma_tank', 10, 20, 0),
      unit('primary', 'defender', 'marine', 100, 20, Math.PI),
      unit('air-target', 'defender', 'scout_drone', 120, 20, Math.PI),
      unit('ground-target', 'defender', 'marine', 150, 20, Math.PI),
    ]
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld(units)

    const nativeResult = runActionSystem(world, 0, 1, nativeActions, actionContext())

    expect(nativeResult).toEqual({ acted: true, actorSynchronized: true })
    expect(nativeActions.some(action =>
      action.type === 'chain_jump' && action.targetId === 'air-target',
    )).toBe(false)
    expect(nativeActions).toContainEqual({
      unitId: 'plasma',
      type: 'chain_jump',
      targetId: 'ground-target',
      value: 1,
    })
  })
})
