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

function runNative(units: SimUnit[]) {
  const nativeActions: Parameters<typeof runActionSystem>[3] = []
  const world = createWorld(units)
  const nativeResult = runActionSystem(world, 0, 1, nativeActions, {
    rng: new PRNG(1),
    tick: 0,
  })
  expect(nativeResult).toEqual({ acted: true, actorSynchronized: true })
  return { world, nativeActions }
}

describe('combat ECS conditional attack', () => {
  it('applies cluster threshold, ID order, damage, and on-hit effects', () => {
    const units = [
      unit('cluster-gun', 'attacker', 10, 100, 0),
      unit('primary', 'defender', 100, 100, Math.PI),
      unit('b-target', 'defender', 110, 100, Math.PI),
      unit('a-target', 'defender', 90, 100, Math.PI),
      unit('outside', 'defender', 190, 100, Math.PI),
    ]
    units[0].conditionalAttackMode = { minTargets: 3, radius: 80, damageMultiplier: 0.5 }
    units[0].statusOnHit = [{ type: 'burn', duration: 30, value: 3 }]
    units[3].isFlying = true

    const { world, nativeActions } = runNative(units)

    expect(world.stores.vitality.require(2).hp)
      .toBeLessThan(world.stores.vitality.require(2).maxHp)
    expect(world.stores.vitality.require(3).hp)
      .toBeLessThan(world.stores.vitality.require(3).maxHp)
    expect(nativeActions).toContainEqual({
      unitId: 'cluster-gun',
      type: 'conditional_attack_mode',
      targetId: 'primary',
      radius: 80,
      value: 0.5,
    })
    const secondaryDamage = nativeActions
      .filter(action => action.type === 'damage' && action.targetId !== 'primary')
      .map(action => action.targetId)
    expect(secondaryDamage).toEqual(['a-target', 'b-target'])
    expect(world.stores.statusControl.require(3).statusEffects.some(effect => effect.type === 'burn')).toBe(true)
  })

  it('does not activate below the configured cluster threshold', () => {
    const units = [
      unit('cluster-gun', 'attacker', 10, 100, 0),
      unit('primary', 'defender', 100, 100, Math.PI),
      unit('secondary', 'defender', 110, 100, Math.PI),
    ]
    units[0].conditionalAttackMode = { minTargets: 3, radius: 80, damageMultiplier: 0.5 }

    const { world, nativeActions } = runNative(units)

    expect(nativeActions.some(action => action.type === 'conditional_attack_mode')).toBe(false)
    expect(world.stores.vitality.require(2).hp).toBe(world.stores.vitality.require(2).maxHp)
  })
})
