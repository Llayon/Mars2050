import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/domains/combat/combat.systems'
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

function expectNativeGeometryParity(units: SimUnit[]): void {
  const legacyUnits = structuredClone(units)
  const legacyActions: Parameters<typeof actionSystem>[4] = []
  const nativeActions: Parameters<typeof runActionSystem>[3] = []
  const world = new CombatWorld(units)
  const entitySpatial = new EntitySpatialIndex()
  entitySpatial.rebuild(world)
  world.resources.set('entitySpatial', entitySpatial)

  const legacyActed = actionSystem(
    legacyUnits[0],
    legacyUnits[1],
    legacyUnits,
    [],
    legacyActions,
    new PRNG(1),
    0,
  )
  const nativeResult = runActionSystem(world, 0, 1, nativeActions, {
    rng: new PRNG(1),
    tick: 0,
  })

  expect(nativeResult).toEqual({ acted: legacyActed, actorSynchronized: true })
  expect(nativeActions).toEqual(legacyActions)
  for (let index = 0; index < legacyUnits.length; index++) {
    const nativeUnit = world.getEntity(index)
    expect(nativeUnit?.hp).toBe(legacyUnits[index].hp)
    expect(nativeUnit?.isDead).toBe(legacyUnits[index].isDead)
    expect(nativeUnit?.statusEffects).toEqual(legacyUnits[index].statusEffects)
    expect(nativeUnit?.targetMark).toEqual(legacyUnits[index].targetMark)
  }
}

describe('combat ECS directional geometry', () => {
  it('matches legacy cone damage and on-hit statuses', () => {
    expectNativeGeometryParity([
      unit('flame', 'attacker', 'flamethrower', 10, 20, 0),
      unit('primary', 'defender', 'marine', 100, 20, Math.PI),
      unit('side', 'defender', 'marine', 80, 44, Math.PI),
      unit('wide', 'defender', 'marine', 55, 90, Math.PI),
    ])
  })

  it('matches legacy line pierce without repeating percent-HP payload', () => {
    expectNativeGeometryParity([
      unit('railgun', 'attacker', 'railgun_walker', 10, 20, 0),
      unit('primary', 'defender', 'marine', 120, 20, Math.PI),
      unit('near', 'defender', 'marine', 65, 24, Math.PI),
      unit('off-line', 'defender', 'marine', 75, 90, Math.PI),
    ])
  })

  it('matches legacy beam order with ramp and vulnerable effects', () => {
    expectNativeGeometryParity([
      unit('ion', 'attacker', 'ion_crawler', 10, 20, 0),
      unit('primary', 'defender', 'marine', 100, 20, Math.PI),
      unit('near', 'defender', 'marine', 140, 28, Math.PI),
      unit('wide', 'defender', 'marine', 150, 90, Math.PI),
    ])
  })
})
