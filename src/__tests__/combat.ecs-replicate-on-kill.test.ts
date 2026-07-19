import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/__tests__/helpers/combat-ecs-action-harness'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { canUseSimpleSingleDamage, runActionSystem } from '@/domains/combat/ecs/systems'
import { SpatialHash } from '@/domains/combat/spatial-hash'

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

describe('combat ECS replicate on kill', () => {
  it('matches canonical clone creation before a seeded death puddle', () => {
    const attacker = unit('replicator', 'attacker', 100)
    const target = unit('victim', 'defender', 220)
    attacker.replicateOnKill = true
    target.hp = 1
    target.onDeathPuddle = 'acid'
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
      new PRNG(41),
      0,
      legacySpatial,
    )
    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    const nativeResult = runActionSystem(world, 0, 1, nativeActions, {
      rng: new PRNG(41),
      tick: 0,
    })

    expect(nativeResult).toEqual({ acted: legacyActed, actorSynchronized: true })
    expect(nativeActions).toEqual(legacyActions)
    world.flushStructuralCommands()
    expect(world.snapshot()).toHaveLength(legacyUnits.length)
    expect(world.snapshot()[2]).toEqual(legacyUnits[2])
    expect(world.snapshot()[2]).toMatchObject({
      team: 'attacker',
      type: 'marine',
      x: 220,
      y: 100,
      hp: attacker.maxHp,
      actionCooldown: 0,
      replicateOnKill: true,
    })
    expect(world.snapshotHazards()).toEqual(legacyHazards)
    expect(nativeActions.slice(-3).map(action => action.type)).toEqual([
      'die',
      'spawn',
      'hazard_spawn',
    ])
    expect(world.snapshot()[2].id).toMatch(/^clone_/)
    expect(world.snapshotHazards()[0].id).toMatch(/^hazard_/)

    const cloneId = world.getEntityId(world.snapshot()[2].id)
    const hazardId = world.getEntityId(world.snapshotHazards()[0].id)
    expect(cloneId).not.toBeUndefined()
    expect(hazardId).not.toBeUndefined()
    expect(world.snapshotEntity(cloneId!)).toEqual(world.snapshot()[2])
    expect(world.getHazard(hazardId!)).toEqual(world.snapshotHazards()[0])
  })
})
