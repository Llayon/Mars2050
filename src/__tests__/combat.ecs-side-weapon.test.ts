import { describe, expect, it } from 'vitest'
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

describe('combat ECS side weapon', () => {
  it('applies fixed damage, target order, and replay without primary on-hit effects', () => {
    const units = [
      unit('goliath', 'attacker', 'goliath_gunship', 10, 20, 0),
      unit('primary', 'defender', 'marine', 120, 20, Math.PI),
      unit('b-target', 'defender', 'marine', 10, 120, Math.PI),
      unit('a-target', 'defender', 'marine', 10, -80, Math.PI),
      unit('outside', 'defender', 'marine', 250, 20, Math.PI),
    ]
    units[0].statusOnHit = [{ type: 'burn', duration: 30, value: 3 }]
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld(units)

    const nativeResult = runActionSystem(world, 0, 1, nativeActions, actionContext())

    expect(nativeResult).toEqual({ acted: true, actorSynchronized: true })
    expect(world.stores.vitality.require(2).hp)
      .toBeLessThan(world.stores.vitality.require(2).maxHp)
    expect(world.stores.vitality.require(3).hp)
      .toBeLessThan(world.stores.vitality.require(3).maxHp)
    expect(nativeActions.filter(action => action.type === 'side_weapon_attack')).toEqual([
      { unitId: 'goliath', type: 'side_weapon_attack', targetId: 'a-target' },
      { unitId: 'goliath', type: 'side_weapon_attack', targetId: 'b-target' },
    ])
    expect(world.stores.statusControl.require(1).statusEffects.some(effect => effect.type === 'burn')).toBe(true)
    expect(world.stores.statusControl.require(2).statusEffects).toEqual([])
    expect(world.stores.statusControl.require(3).statusEffects).toEqual([])
  })

  it('uses the side weapon air-targeting capability independently', () => {
    const units = [
      unit('goliath', 'attacker', 'goliath_gunship', 10, 20, 0),
      unit('primary', 'defender', 'marine', 120, 20, Math.PI),
      unit('air-target', 'defender', 'scout_drone', 90, 50, Math.PI),
    ]
    units[0].canTargetAir = false
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld(units)

    const nativeResult = runActionSystem(world, 0, 1, nativeActions, actionContext())

    expect(nativeResult).toEqual({ acted: true, actorSynchronized: true })
    expect(nativeActions).toContainEqual({
      unitId: 'goliath',
      type: 'side_weapon_attack',
      targetId: 'air-target',
    })
  })
})
