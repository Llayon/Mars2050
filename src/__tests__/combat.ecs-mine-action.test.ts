import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/__tests__/helpers/combat-ecs-action-harness'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import {
  canUseEcsMineAction,
  canUseEcsSmokeAction,
  canUseSimpleSingleDamage,
  runActionSystem,
} from '@/domains/combat/ecs/systems'
import { SpatialHash } from '@/domains/combat/spatial-hash'

function unit(
  id: string,
  team: 'attacker' | 'defender',
  type: string,
  x: number,
): SimUnit {
  return createRuntimeUnitFromConfig({
    id,
    team,
    type,
    x,
    y: 100,
    currentAngle: team === 'attacker' ? 0 : Math.PI,
  })!
}

function createWorld(units: SimUnit[]): CombatWorld {
  const world = new CombatWorld(units)
  const spatial = new EntitySpatialIndex()
  spatial.rebuild(world)
  world.resources.set('entitySpatial', spatial)
  return world
}

describe('combat ECS mine action', () => {
  it('matches seeded legacy deployment and preserves priority over smoke', () => {
    const attacker = unit('minelayer', 'attacker', 'minelayer_rover', 100)
    const target = unit('target', 'defender', 'marine', 220)
    attacker.smokeOnAction = { radius: 80, duration: 30, rangeSuppression: 0.5 }
    const legacyUnits = structuredClone([attacker, target])
    const legacyHazards: Parameters<typeof actionSystem>[3] = []
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const legacySpatial = new SpatialHash()
    for (const legacyUnit of legacyUnits) legacySpatial.insert(legacyUnit)
    const world = createWorld([attacker, target])

    const legacyActed = actionSystem(
      legacyUnits[0],
      legacyUnits[1],
      legacyUnits,
      legacyHazards,
      legacyActions,
      new PRNG(11),
      0,
      legacySpatial,
    )
    expect(canUseEcsMineAction(world, 0)).toBe(true)
    expect(canUseEcsSmokeAction(world, 0)).toBe(true)
    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    const nativeResult = runActionSystem(world, 0, 1, nativeActions, {
      rng: new PRNG(11),
      tick: 0,
    })

    expect(nativeResult).toEqual({ acted: legacyActed, actorSynchronized: true })
    expect(nativeActions).toEqual(legacyActions)
    world.flushStructuralCommands()
    expect(world.snapshotHazards()).toEqual(legacyHazards)
    expect(world.snapshotHazards()).toHaveLength(1)
    expect(world.snapshotHazards()[0]).toMatchObject({
      team: 'attacker',
      type: 'mine',
      radius: 42,
      damagePerTick: 65,
      duration: 90,
      sourceUnitId: 'minelayer',
    })
    expect(world.stores.vitality.require(1).hp).toBe(legacyUnits[1].hp)
    expect(world.stores.combat.require(0).actionCooldown).toBe(legacyUnits[0].actionCooldown)
    expect(nativeActions).toHaveLength(1)
    expect(nativeActions[0]).toMatchObject({
      unitId: 'minelayer',
      type: 'hazard_spawn',
      radius: 42,
    })

    world.flushStructuralCommands()
    const hazardId = world.getEntityId(world.snapshotHazards()[0].id)
    expect(hazardId).not.toBeUndefined()
    expect(world.getHazard(hazardId!)).toEqual(world.snapshotHazards()[0])
  })
})
