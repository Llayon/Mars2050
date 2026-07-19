import { describe, expect, it } from 'vitest'
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
  it('deploys deterministically and preserves priority over smoke', () => {
    const attacker = unit('minelayer', 'attacker', 'minelayer_rover', 100)
    const target = unit('target', 'defender', 'marine', 220)
    attacker.smokeOnAction = { radius: 80, duration: 30, rangeSuppression: 0.5 }
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld([attacker, target])

    expect(canUseEcsMineAction(world, 0)).toBe(true)
    expect(canUseEcsSmokeAction(world, 0)).toBe(true)
    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    const nativeResult = runActionSystem(world, 0, 1, nativeActions, {
      rng: new PRNG(11),
      tick: 0,
    })

    expect(nativeResult).toEqual({ acted: true, actorSynchronized: true })
    world.flushStructuralCommands()
    expect(world.snapshotHazards()).toHaveLength(1)
    expect(world.snapshotHazards()[0]).toMatchObject({
      team: 'attacker',
      type: 'mine',
      radius: 42,
      damagePerTick: 65,
      duration: 90,
      sourceUnitId: 'minelayer',
    })
    expect(world.stores.vitality.require(1).hp).toBe(target.maxHp)
    expect(world.stores.combat.require(0).actionCooldown).toBeGreaterThan(0)
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
