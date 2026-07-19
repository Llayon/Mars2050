import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/__tests__/helpers/combat-ecs-action-harness'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { canUseSimpleSingleDamage, runActionSystem } from '@/domains/combat/ecs/systems'
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

describe('combat ECS attack puddle action', () => {
  it('matches seeded napalm creation for every multishot hit', () => {
    const attacker = unit('buggy', 'attacker', 'missile_buggy', 100)
    const target = unit('target', 'defender', 'marine', 300)
    attacker.leavesPuddle = true
    attacker.multishot = 2
    target.hp = target.maxHp = 1000
    const legacyUnits = structuredClone([attacker, target])
    const legacyHazards: Parameters<typeof actionSystem>[3] = []
    const world = createWorld([attacker, target])
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const legacySpatial = new SpatialHash()
    for (const legacyUnit of legacyUnits) legacySpatial.insert(legacyUnit)

    const legacyActed = actionSystem(
      legacyUnits[0],
      legacyUnits[1],
      legacyUnits,
      legacyHazards,
      legacyActions,
      new PRNG(7),
      0,
      legacySpatial,
    )
    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    const nativeResult = runActionSystem(world, 0, 1, nativeActions, {
      rng: new PRNG(7),
      tick: 0,
    })

    expect(nativeResult).toEqual({
      acted: legacyActed,
      actorSynchronized: true,
    })
    expect(nativeActions).toEqual(legacyActions)
    expect(nativeActions.some(action => action.type === 'hazard_spawn')).toBe(false)
    expect(world.hazards).toEqual(legacyHazards)
    expect(world.hazards).toHaveLength(2)
    expect(world.hazards[0]).toMatchObject({
      team: 'attacker',
      type: 'napalm',
      x: 300,
      y: 100,
      radius: 40,
      damagePerTick: 5,
      duration: 50,
    })

    world.flushStructuralCommands()
    for (const hazard of world.hazards) {
      const entityId = world.getEntityId(hazard.id)
      expect(entityId).not.toBeUndefined()
      expect(world.getHazard(entityId!)).toEqual(hazard)
    }
  })
})
