import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/__tests__/helpers/combat-ecs-action-harness'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { canUseEcsSpawnAction, runActionSystem } from '@/domains/combat/ecs/systems'

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

function context(seed: number) {
  return { rng: new PRNG(seed), tick: 0 }
}

describe('combat ECS spawn action', () => {
  it('matches seeded legacy creation through the structural buffer', () => {
    const carrier = unit('carrier', 'attacker', 'drone_carrier', 100)
    const target = unit('target', 'defender', 'marine', 500)
    const legacyUnits = structuredClone([carrier, target])
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld([carrier, target])

    const legacyActed = actionSystem(
      legacyUnits[0],
      legacyUnits[1],
      legacyUnits,
      [],
      legacyActions,
      new PRNG(17),
    )
    expect(canUseEcsSpawnAction(world, 0)).toBe(true)
    const nativeResult = runActionSystem(world, 0, 1, nativeActions, context(17))

    expect(nativeResult).toEqual({ acted: legacyActed, actorSynchronized: true })
    expect(nativeActions).toEqual(legacyActions)
    expect(world.roster).toHaveLength(legacyUnits.length)
    expect(world.roster[2]).toEqual(legacyUnits[2])
    expect(world.roster[2]).toMatchObject({
      summonOwnerId: 'carrier',
      team: 'attacker',
      type: 'scout_drone',
      speed: 180,
      range: 120,
      markOnHit: { squadWide: true },
    })
    expect(world.getEntityId(world.roster[2].id)).toBeUndefined()

    world.flushStructuralCommands()
    const spawnedId = world.getEntityId(world.roster[2].id)
    expect(spawnedId).not.toBeUndefined()
    expect(world.snapshotEntity(spawnedId!)).toEqual(world.roster[2])
  })

  it('matches cap blocking and the shortened retry cooldown', () => {
    const carrier = unit('carrier', 'attacker', 'drone_carrier', 100)
    carrier.spawnCap = 1
    const summon = unit('summon', 'attacker', 'scout_drone', 140)
    summon.summonOwnerId = 'carrier'
    const target = unit('target', 'defender', 'marine', 500)
    const legacyUnits = structuredClone([carrier, summon, target])
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld([carrier, summon, target])

    const legacyActed = actionSystem(
      legacyUnits[0],
      legacyUnits[2],
      legacyUnits,
      [],
      legacyActions,
      new PRNG(19),
    )
    const nativeResult = runActionSystem(world, 0, 2, nativeActions, context(19))

    expect(nativeResult).toEqual({ acted: legacyActed, actorSynchronized: true })
    expect(nativeResult.acted).toBe(false)
    expect(nativeActions).toEqual(legacyActions)
    expect(nativeActions).toEqual([
      { unitId: 'carrier', type: 'spawn_blocked', value: 1 },
    ])
    expect(world.stores.combat.require(0).actionCooldown).toBe(5)
    expect(world.roster).toHaveLength(3)
  })

  it('matches source-configured spawn overrides', () => {
    const projector = unit('projector', 'attacker', 'hologram_projector', 100)
    const target = unit('target', 'defender', 'marine', 500)
    const legacyUnits = structuredClone([projector, target])
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld([projector, target])

    actionSystem(
      legacyUnits[0],
      legacyUnits[1],
      legacyUnits,
      [],
      legacyActions,
      new PRNG(23),
    )
    runActionSystem(world, 0, 1, nativeActions, context(23))

    expect(nativeActions).toEqual(legacyActions)
    expect(world.roster[2]).toEqual(legacyUnits[2])
    expect(world.roster[2]).toMatchObject({
      type: 'exosuit',
      hp: 35,
      maxHp: 35,
      attack: 0,
      isTemporary: true,
      temporaryDuration: 80,
    })
  })
})
