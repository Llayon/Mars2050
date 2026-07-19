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

function runNativeGeometry(units: SimUnit[]) {
  const nativeActions: Parameters<typeof runActionSystem>[3] = []
  const world = new CombatWorld(units)
  const entitySpatial = new EntitySpatialIndex()
  entitySpatial.rebuild(world)
  world.resources.set('entitySpatial', entitySpatial)

  const nativeResult = runActionSystem(world, 0, 1, nativeActions, {
    rng: new PRNG(1),
    tick: 0,
  })

  expect(nativeResult).toEqual({ acted: true, actorSynchronized: true })
  return { world, nativeActions }
}

describe('combat ECS directional geometry', () => {
  it('applies cone damage and on-hit statuses only inside the cone', () => {
    const { world, nativeActions } = runNativeGeometry([
      unit('flame', 'attacker', 'flamethrower', 10, 20, 0),
      unit('primary', 'defender', 'marine', 100, 20, Math.PI),
      unit('side', 'defender', 'marine', 80, 44, Math.PI),
      unit('wide', 'defender', 'marine', 55, 90, Math.PI),
    ])

    expect(nativeActions.some(action => action.type === 'cone_attack')).toBe(true)
    expect(world.stores.vitality.require(2).hp).toBeLessThan(
      world.stores.vitality.require(2).maxHp,
    )
    expect(world.stores.statusControl.require(2).statusEffects).toContainEqual(
      expect.objectContaining({ type: 'burn' }),
    )
    expect(world.stores.vitality.require(3).hp).toBe(
      world.stores.vitality.require(3).maxHp,
    )
  })

  it('applies line pierce without repeating the primary percent-HP payload', () => {
    const { world, nativeActions } = runNativeGeometry([
      unit('railgun', 'attacker', 'railgun_walker', 10, 20, 0),
      unit('primary', 'defender', 'marine', 120, 20, Math.PI),
      unit('near', 'defender', 'marine', 65, 24, Math.PI),
      unit('off-line', 'defender', 'marine', 75, 90, Math.PI),
    ])

    expect(nativeActions.filter(action => action.type === 'attack')).toHaveLength(2)
    expect(world.stores.vitality.require(2).hp).toBeLessThan(
      world.stores.vitality.require(2).maxHp,
    )
    expect(world.stores.vitality.require(3).hp).toBe(
      world.stores.vitality.require(3).maxHp,
    )
  })

  it('orders beam targets and applies vulnerable on secondary hits', () => {
    const { world, nativeActions } = runNativeGeometry([
      unit('ion', 'attacker', 'ion_crawler', 10, 20, 0),
      unit('primary', 'defender', 'marine', 100, 20, Math.PI),
      unit('near', 'defender', 'marine', 140, 28, Math.PI),
      unit('wide', 'defender', 'marine', 150, 90, Math.PI),
    ])

    expect(nativeActions.some(action => action.type === 'beam_tick')).toBe(true)
    expect(world.stores.statusControl.require(2).statusEffects).toContainEqual(
      expect.objectContaining({ type: 'vulnerable' }),
    )
    expect(world.stores.vitality.require(3).hp).toBe(
      world.stores.vitality.require(3).maxHp,
    )
  })
})
