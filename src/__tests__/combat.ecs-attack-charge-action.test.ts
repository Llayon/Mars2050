import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/domains/combat/combat.systems'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
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

describe('combat ECS attack charge action', () => {
  it('matches legacy release and consumes charge only on the first shot', () => {
    const attacker = unit('launcher', 'attacker', 100)
    const target = unit('target', 'defender', 220)
    attacker.multishot = 2
    attacker.attackCharge = {
      intervalTicks: 3,
      maxStacks: 3,
      attackMultPerStack: 0.25,
      nextTick: 4,
      stacks: 3,
    }
    target.hp = target.maxHp = 1000
    const legacyUnits = structuredClone([attacker, target])
    const world = createWorld([attacker, target])
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const legacySpatial = new SpatialHash()
    for (const legacyUnit of legacyUnits) legacySpatial.insert(legacyUnit)

    const legacyActed = actionSystem(
      legacyUnits[0],
      legacyUnits[1],
      legacyUnits,
      [],
      legacyActions,
      new PRNG(1),
      11,
      legacySpatial,
    )
    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    const nativeResult = runActionSystem(world, 0, 1, nativeActions, {
      rng: new PRNG(1),
      tick: 11,
      spatialHash: new SpatialHash(),
    })

    expect(nativeResult).toEqual({
      acted: legacyActed,
      actorSynchronized: true,
    })
    expect(nativeActions).toEqual(legacyActions)
    expect(nativeActions.filter(action =>
      action.type === 'attack_charge_release',
    )).toEqual([
      {
        unitId: 'launcher',
        type: 'attack_charge_release',
        value: 3,
        damage: 7,
      },
    ])
    expect(nativeActions.filter(action => action.type === 'attack')).toHaveLength(2)
    expect(world.stores.vitality.require(1).hp).toBe(legacyUnits[1].hp)
    expect(world.stores.lifecycle.require(0).attackCharge).toEqual({
      intervalTicks: 3,
      maxStacks: 3,
      attackMultPerStack: 0.25,
      nextTick: 14,
      stacks: 0,
    })
    expect(world.getEntity(0)?.attackCharge).toEqual(
      legacyUnits[0].attackCharge,
    )
  })
})
