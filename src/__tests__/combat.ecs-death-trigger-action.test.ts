import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/domains/combat/combat.systems'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import {
  canUseSimpleSingleDamage,
  runActionSystem,
} from '@/domains/combat/ecs/systems'

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
    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    runActionSystem(world, 0, 1, nativeActions, {
      rng: world.resources.require('rng'),
      tick: 0,
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

  it('matches capped death spawns through the structural buffer', () => {
    const attacker = unit('attacker', 'attacker', 'marine', 100)
    const target = unit('carrier-wreck', 'defender', 'marine', 220)
    attacker.attack = 200
    target.hp = 20
    target.defense = 0
    target.triggerEffects = [{
      id: 'mechanical-division',
      event: 'death',
      payload: {
        kind: 'spawn',
        target: 'self',
        unitType: 'alien_bug',
        count: 2,
        cap: 1,
        hpPercent: 0.5,
      },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    const legacyUnits = structuredClone([attacker, target])
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld([attacker, target])
    world.resources.set('rng', new PRNG(83))

    actionSystem(
      legacyUnits[0],
      legacyUnits[1],
      legacyUnits,
      [],
      legacyActions,
      new PRNG(83),
    )
    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    runActionSystem(world, 0, 1, nativeActions, {
      rng: world.resources.require('rng'),
      tick: 0,
    })
    world.flushStructuralCommands()

    expect(nativeActions).toEqual(legacyActions)
    const spawned = world.roster.filter(unit => unit.summonOwnerId === 'carrier-wreck')
    expect(spawned).toHaveLength(1)
    expect(spawned[0]).toMatchObject({
      type: 'alien_bug',
      team: 'defender',
      hp: 10,
      maxHp: 10,
    })
  })

  it('matches delayed self-reassembly state after death', () => {
    const attacker = unit('attacker', 'attacker', 'marine', 100)
    const target = unit('reassembler', 'defender', 'marine', 220)
    attacker.attack = 200
    target.hp = 20
    target.defense = 0
    target.triggerEffects = [{
      id: 'rebuild',
      event: 'death',
      payload: {
        kind: 'delayed_reassembly',
        target: 'self',
        delayTicks: 3.8,
        hpPercent: 0.4,
      },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    const legacyUnits = structuredClone([attacker, target])
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld([attacker, target])

    actionSystem(
      legacyUnits[0],
      legacyUnits[1],
      legacyUnits,
      [],
      legacyActions,
      new PRNG(89),
    )
    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    runActionSystem(world, 0, 1, nativeActions, {
      rng: new PRNG(89),
      tick: 0,
    })

    expect(nativeActions).toEqual(legacyActions)
    expect(world.stores.vitality.require(1)).toMatchObject({
      reassemblyTriggersUsed: 1,
      reassemblyState: {
        remainingTicks: 3,
        hpPercent: 0.4,
        sourceUnitId: 'reassembler',
      },
    })
    expect(nativeActions.slice(-2).map(action => action.type)).toEqual([
      'trigger_effect',
      'reassembly_start',
    ])
  })

  it('matches radial death-trigger damage on the native path', () => {
    const attacker = unit('attacker', 'attacker', 'marine', 100)
    const target = unit('explosive-wreck', 'defender', 'marine', 220)
    attacker.hp = attacker.maxHp = 100
    attacker.defense = 0
    target.hp = 20
    target.defense = 0
    attacker.attack = 200
    target.triggerEffects = [{
      id: 'detonation',
      event: 'death',
      payload: { kind: 'damage', target: 'self', amount: 30, radius: 150 },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    const legacyUnits = structuredClone([attacker, target])
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld([attacker, target])

    actionSystem(
      legacyUnits[0],
      legacyUnits[1],
      legacyUnits,
      [],
      legacyActions,
      new PRNG(97),
    )
    runActionSystem(world, 0, 1, nativeActions, {
      rng: new PRNG(97),
      tick: 0,
    })

    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    expect(nativeActions).toEqual(legacyActions)
    expect(world.stores.vitality.require(0).hp).toBe(legacyUnits[0].hp)
  })
})
