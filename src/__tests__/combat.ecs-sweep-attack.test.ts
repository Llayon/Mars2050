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
  x: number,
  y: number,
  angle: number,
): SimUnit {
  return createRuntimeUnitFromConfig({ id, team, type: 'marine', x, y, currentAngle: angle })!
}

function createWorld(units: SimUnit[]): CombatWorld {
  const world = new CombatWorld(units)
  const entitySpatial = new EntitySpatialIndex()
  entitySpatial.rebuild(world)
  world.resources.set('entitySpatial', entitySpatial)
  return world
}

describe('combat ECS sweep attack', () => {
  it('matches strip order, size multiplier, air handling, and replay actions', () => {
    const units = [
      unit('sweeper', 'attacker', 10, 100, 0),
      unit('primary', 'defender', 100, 100, Math.PI),
      unit('b-target', 'defender', 102, 110, Math.PI),
      unit('a-target', 'defender', 98, 90, Math.PI),
      unit('outside', 'defender', 140, 100, Math.PI),
    ]
    units[0].sweepAttack = {
      width: 20,
      damageMultiplier: 0.5,
      maxTargets: 2,
      sizeBonusMultiplier: { XL: 2 },
    }
    units[0].statusOnHit = [{ type: 'burn', duration: 30, value: 3 }]
    units[2].isFlying = true
    units[3].size = 'XL'
    const legacyUnits = structuredClone(units)
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld(units)
    const entitySpatial = world.resources.require('entitySpatial')

    const legacyActed = actionSystem(
      legacyUnits[0],
      legacyUnits[1],
      legacyUnits,
      [],
      legacyActions,
      new PRNG(1),
    )
    const nativeResult = runActionSystem(world, 0, 1, nativeActions, {
      rng: new PRNG(1),
      tick: 0,
    })

    expect(nativeResult).toEqual({ acted: legacyActed, actorSynchronized: true })
    expect(nativeActions).toEqual(legacyActions)
    expect(world.stores.vitality.require(2).hp).toBe(legacyUnits[2].hp)
    expect(world.stores.vitality.require(3).hp).toBe(legacyUnits[3].hp)
    expect(nativeActions.filter(action => action.type === 'sweep_hit')).toEqual([
      { unitId: 'sweeper', type: 'sweep_hit', targetId: 'a-target', value: 1 },
      { unitId: 'sweeper', type: 'sweep_hit', targetId: 'b-target', value: 0.5 },
    ])
    expect(world.stores.statusControl.require(2).statusEffects.some(effect => effect.type === 'burn')).toBe(true)
    expect(world.stores.statusControl.require(3).statusEffects.some(effect => effect.type === 'burn')).toBe(true)
    expect(entitySpatial.query(world, 102, 110, 1)).toContain(2)
  })
})
