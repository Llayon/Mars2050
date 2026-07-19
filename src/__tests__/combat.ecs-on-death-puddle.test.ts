import { describe, expect, it } from 'vitest'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { canUseSimpleSingleDamage, runActionSystem } from '@/domains/combat/ecs/systems'

function unit(id: string, team: 'attacker' | 'defender', x: number): SimUnit {
  return createRuntimeUnitFromConfig({
    id,
    team,
    type: 'marine',
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

describe('combat ECS on-death puddle', () => {
  it('creates a deterministic acid hazard after a weapon death', () => {
    const attacker = unit('attacker', 'attacker', 100)
    const target = unit('acidic', 'defender', 220)
    target.hp = 1
    target.onDeathPuddle = 'acid'
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld([attacker, target])

    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    const nativeResult = runActionSystem(world, 0, 1, nativeActions, {
      rng: new PRNG(37),
      tick: 0,
    })

    expect(nativeResult).toEqual({ acted: true, actorSynchronized: true })
    world.flushStructuralCommands()
    expect(world.snapshotHazards()).toHaveLength(1)
    expect(world.snapshotHazards()[0]).toMatchObject({
      team: 'defender',
      type: 'acid',
      x: 220,
      y: 100,
      radius: 50,
      damagePerTick: Math.floor(target.maxHp * 0.1),
      duration: 40,
      sourceUnitId: 'acidic',
    })
    expect(nativeActions.slice(-2).map(action => action.type)).toEqual([
      'die',
      'hazard_spawn',
    ])

    world.flushStructuralCommands()
    const hazardId = world.getEntityId(world.snapshotHazards()[0].id)
    expect(hazardId).not.toBeUndefined()
    expect(world.getHazard(hazardId!)).toEqual(world.snapshotHazards()[0])
  })
})
