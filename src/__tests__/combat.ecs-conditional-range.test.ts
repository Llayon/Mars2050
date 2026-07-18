import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/domains/combat/combat.systems'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { getEffectiveActionRangeAgainst } from '@/domains/combat/combat.weapon-rules'
import { getSizeRadius, PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import {
  getEcsEffectiveActionRangeAgainst,
  getEcsPositioningDecision,
} from '@/domains/combat/ecs/movement-positioning'
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

describe('combat ECS conditional range', () => {
  it('matches sequential air, tag, and rank range modifiers', () => {
    const attacker = unit('attacker', 'attacker', 100)
    const target = unit('target', 'defender', 230)
    attacker.range = 100
    attacker.rank = 1
    attacker.conditionalRange = [
      { target: 'air', rangeMult: 1.5 },
      { target: 'tag', tag: 'infantry', rangeAdd: 20 },
      { target: 'higher_rank', rangeMult: 2 },
    ]
    target.isFlying = true
    target.rank = 2
    const world = createWorld([attacker, target])

    expect(getEcsEffectiveActionRangeAgainst(world, 0, 1)).toBe(
      getEffectiveActionRangeAgainst(attacker, target),
    )
    expect(getEcsEffectiveActionRangeAgainst(world, 0, 1)).toBe(340)
  })

  it('uses target-aware range for both positioning and native action resolution', () => {
    const airAttacker = unit('aa-air', 'attacker', 100)
    const airTarget = unit('air', 'defender', 230)
    airAttacker.range = 100
    airAttacker.canTargetAir = true
    airAttacker.conditionalRange = [{ target: 'air', rangeAdd: 60 }]
    airTarget.isFlying = true
    const legacyUnits = structuredClone([airAttacker, airTarget])
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const airWorld = createWorld([airAttacker, airTarget])
    const targetRadius = getSizeRadius(airTarget.size)
    const attackerRadius = getSizeRadius(airAttacker.size)
    const edgeDistance = 130 - targetRadius - attackerRadius

    const legacyActed = actionSystem(
      legacyUnits[0],
      legacyUnits[1],
      legacyUnits,
      [],
      legacyActions,
      new PRNG(31),
    )
    expect(canUseSimpleSingleDamage(airWorld, 0, 1)).toBe(true)
    const nativeResult = runActionSystem(airWorld, 0, 1, nativeActions, {
      rng: new PRNG(31),
      tick: 0,
      spatialHash: new SpatialHash(),
    })
    const airPositioning = getEcsPositioningDecision(
      airWorld,
      0,
      1,
      edgeDistance,
      targetRadius,
      attackerRadius,
    )

    expect(nativeResult).toEqual({ acted: legacyActed, actorSynchronized: true })
    expect(nativeActions).toEqual(legacyActions)
    expect(airPositioning).toMatchObject({ shouldMove: false, combatInRange: true })

    const groundAttacker = unit('aa-ground', 'attacker', 100)
    const groundTarget = unit('ground', 'defender', 230)
    groundAttacker.range = 100
    groundAttacker.conditionalRange = [{ target: 'air', rangeAdd: 60 }]
    const groundWorld = createWorld([groundAttacker, groundTarget])
    const groundPositioning = getEcsPositioningDecision(
      groundWorld,
      0,
      1,
      edgeDistance,
      targetRadius,
      attackerRadius,
    )

    expect(groundPositioning).toMatchObject({ shouldMove: true, combatInRange: false })
  })
})
