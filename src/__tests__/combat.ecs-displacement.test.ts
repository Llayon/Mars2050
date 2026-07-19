import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/__tests__/helpers/combat-ecs-action-harness'
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

function expectParity(units: SimUnit[]): {
  world: CombatWorld
  legacyUnits: SimUnit[]
  nativeActions: Parameters<typeof runActionSystem>[3]
} {
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
  return { world, legacyUnits, nativeActions }
}

describe('combat ECS displacement', () => {
  it('matches gravity pull after primary and radial AoE damage', () => {
    const { world, legacyUnits, nativeActions } = expectParity([
      unit('gravity', 'attacker', 'gravity_manipulator', 10, 100, 0),
      unit('primary', 'defender', 'marine', 150, 100, Math.PI),
      unit('nearby', 'defender', 'marine', 220, 100, Math.PI),
      unit('flyer', 'defender', 'scout_drone', 210, 100, Math.PI),
    ])

    expect(world.stores.transform.require(1).x).toBe(legacyUnits[1].x)
    expect(world.stores.transform.require(2).x).toBe(legacyUnits[2].x)
    expect(world.stores.transform.require(3).x).toBe(legacyUnits[3].x)
    expect(nativeActions.at(-1)).toMatchObject({
      unitId: 'nearby',
      type: 'move',
      fromX: 220,
      toX: legacyUnits[2].x,
    })
  })

  it('matches sonic knockback after primary and cone damage', () => {
    const { world, legacyUnits, nativeActions } = expectParity([
      unit('sonic', 'attacker', 'sonic_devastator', 10, 100, 0),
      unit('primary', 'defender', 'marine', 150, 100, Math.PI),
      unit('nearby', 'defender', 'marine', 180, 100, Math.PI),
      unit('ally', 'attacker', 'marine', 170, 100, 0),
    ])

    expect(world.stores.transform.require(1).x).toBe(legacyUnits[1].x)
    expect(world.stores.transform.require(2).x).toBe(legacyUnits[2].x)
    expect(world.stores.transform.require(3).x).toBe(legacyUnits[3].x)
    expect(nativeActions.slice(-2).map(action => action.type)).toEqual(['knockback', 'knockback'])
    expect(nativeActions.at(-2)).toMatchObject({ unitId: 'primary', fromX: 150 })
    expect(nativeActions.at(-1)).toMatchObject({ unitId: 'nearby', fromX: 180 })
  })
})
