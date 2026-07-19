import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/domains/combat/combat.systems'
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

describe('combat ECS split fire', () => {
  it('matches legacy target order, damage, and replay actions', () => {
    const units = [
      unit('gatling', 'attacker', 'gatling_rover', 10, 20, 0),
      unit('primary', 'defender', 'marine', 100, 20, Math.PI),
      unit('b-target', 'defender', 'marine', 10, 110, Math.PI),
      unit('a-target', 'defender', 'marine', 10, -70, Math.PI),
      unit('outside', 'defender', 'marine', 250, 20, Math.PI),
    ]
    const legacyUnits = structuredClone(units)
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld(units)

    const legacyActed = actionSystem(
      legacyUnits[0],
      legacyUnits[1],
      legacyUnits,
      [],
      legacyActions,
      new PRNG(1),
    )
    const nativeResult = runActionSystem(world, 0, 1, nativeActions, actionContext())

    expect(nativeResult).toEqual({ acted: legacyActed, actorSynchronized: true })
    expect(nativeActions).toEqual(legacyActions)
    expect(world.stores.vitality.require(1).hp).toBe(legacyUnits[1].hp)
    expect(world.stores.vitality.require(2).hp).toBe(legacyUnits[2].hp)
    expect(world.stores.vitality.require(3).hp).toBe(legacyUnits[3].hp)
    expect(nativeActions.filter(action => action.type === 'split_fire')).toEqual([
      { unitId: 'gatling', type: 'split_fire', targetId: 'a-target' },
      { unitId: 'gatling', type: 'split_fire', targetId: 'b-target' },
    ])
  })

  it('matches opt-out minimum damage and still applies on-hit suppression', () => {
    const units = [
      unit('gunner', 'attacker', 'heavy_gunner', 10, 20, 0),
      unit('primary', 'defender', 'marine', 100, 20, Math.PI),
      unit('secondary', 'defender', 'marine', 80, 50, Math.PI),
    ]
    units[2].defense = 5
    const legacyUnits = structuredClone(units)
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld(units)

    actionSystem(legacyUnits[0], legacyUnits[1], legacyUnits, [], legacyActions, new PRNG(1))
    const nativeResult = runActionSystem(world, 0, 1, nativeActions, actionContext())

    expect(nativeResult).toEqual({ acted: true, actorSynchronized: true })
    expect(nativeActions).toEqual(legacyActions)
    expect(world.stores.vitality.require(2).hp).toBe(legacyUnits[2].hp)
    expect(world.stores.vitality.require(2).hp).toBe(world.stores.vitality.require(2).maxHp)
    expect(world.stores.statusControl.require(2).statusEffects).toEqual(legacyUnits[2].statusEffects)
    expect(nativeActions).toContainEqual({
      unitId: 'secondary',
      type: 'status_apply',
      statusType: 'output_suppressed',
      value: 0.18,
    })
  })

  it('uses the secondary weapon air-targeting capability', () => {
    const units = [
      unit('gatling', 'attacker', 'gatling_rover', 10, 20, 0),
      unit('primary', 'defender', 'marine', 100, 20, Math.PI),
      unit('air-target', 'defender', 'scout_drone', 80, 50, Math.PI),
    ]
    units[0].canTargetAir = false
    const legacyUnits = structuredClone(units)
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld(units)

    actionSystem(legacyUnits[0], legacyUnits[1], legacyUnits, [], legacyActions, new PRNG(1))
    const nativeResult = runActionSystem(world, 0, 1, nativeActions, actionContext())

    expect(nativeResult).toEqual({ acted: true, actorSynchronized: true })
    expect(nativeActions).toEqual(legacyActions)
    expect(nativeActions).toContainEqual({
      unitId: 'gatling',
      type: 'split_fire',
      targetId: 'air-target',
    })
  })
})
