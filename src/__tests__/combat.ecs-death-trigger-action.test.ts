import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/domains/combat/combat.systems'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import {
  canUseEcsDeathTriggers,
  canUseSimpleSingleDamage,
  runActionSystem,
} from '@/domains/combat/ecs/systems'
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

describe('combat ECS death-trigger action', () => {
  it('matches death triggers before killer effects and death hazards', () => {
    const attacker = unit('ghost', 'attacker', 'stealth_operative', 100)
    const target = unit('wreck', 'defender', 'marine', 220)
    attacker.hp = 50
    target.triggerEffects = [{
      id: 'reactive-shield',
      event: 'death',
      payload: { kind: 'shield', target: 'killer', amount: 30 },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    target.onDeathPuddle = 'acid'
    const legacyUnits = structuredClone([attacker, target])
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const legacyHazards: Parameters<typeof actionSystem>[3] = []
    const world = createWorld([attacker, target])
    world.resources.set('rng', new PRNG(79))

    actionSystem(
      legacyUnits[0],
      legacyUnits[1],
      legacyUnits,
      legacyHazards,
      legacyActions,
      new PRNG(79),
    )
    expect(canUseEcsDeathTriggers(world, 1)).toBe(true)
    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    runActionSystem(world, 0, 1, nativeActions, {
      rng: world.resources.require('rng'),
      tick: 0,
      spatialHash: new SpatialHash(),
    })

    expect(nativeActions).toEqual(legacyActions)
    expect(world.stores.vitality.require(0)).toMatchObject({
      hp: legacyUnits[0].hp,
      shield: 30,
    })
    expect(world.stores.lifecycle.require(1).triggerEffects).toEqual(
      legacyUnits[1].triggerEffects,
    )
    expect(nativeActions.slice(-5).map(action => action.type)).toEqual([
      'trigger_effect',
      'shield_apply',
      'on_kill',
      'heal',
      'hazard_spawn',
    ])
  })

  it('keeps unsupported death spawns on the legacy path', () => {
    const attacker = unit('attacker', 'attacker', 'marine', 100)
    const target = unit('carrier-wreck', 'defender', 'marine', 220)
    target.triggerEffects = [{
      id: 'mechanical-division',
      event: 'death',
      payload: {
        kind: 'spawn',
        target: 'self',
        unitType: 'alien_bug',
        count: 2,
      },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    const world = createWorld([attacker, target])

    expect(canUseEcsDeathTriggers(world, 1)).toBe(false)
    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(false)
  })
})
