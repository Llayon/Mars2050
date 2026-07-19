import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { normalizeStatusEffect } from '@/domains/combat/combat.status-core'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { runEcsPeriodicAbilitySystem } from '@/domains/combat/ecs/systems'

function unit(
  id: string,
  team: 'attacker' | 'defender',
  x: number,
): SimUnit {
  return createRuntimeUnitFromConfig({
    id,
    team,
    type: 'marine',
    x,
    y: 500,
    currentAngle: 0,
  })!
}

describe('combat ECS periodic ability phase', () => {
  it('runs payloads, scheduling, spawning, and replay in order', () => {
    const source = unit('source', 'attacker', 100)
    source.hp = Math.max(1, source.maxHp - 10)
    source.periodicAbilities = [
      {
        id: 'damage',
        intervalTicks: 5,
        nextTick: 0,
        chargesRemaining: 1,
        targetPolicy: 'nearest_enemy',
        payload: {
          kind: 'damage',
          amount: 3,
          radius: 60,
          percentHp: { basis: 'current', percent: 0.1 },
          statusEffects: [{ type: 'slow', duration: 5, value: 0.5 }],
        },
      },
      {
        id: 'status',
        intervalTicks: 5,
        nextTick: 0,
        chargesRemaining: 1,
        targetPolicy: 'nearest_enemy',
        payload: { kind: 'status', effects: [{ type: 'emp', duration: 4 }] },
      },
      {
        id: 'hazard',
        intervalTicks: 5,
        nextTick: 0,
        chargesRemaining: 1,
        targetPolicy: 'nearest_enemy',
        payload: {
          kind: 'hazard',
          hazardType: 'napalm',
          radius: 30,
          duration: 10,
          damagePerTick: 2,
        },
      },
      {
        id: 'shield',
        intervalTicks: 5,
        nextTick: 0,
        chargesRemaining: 1,
        targetPolicy: 'self',
        payload: { kind: 'shield', amount: 12 },
      },
      {
        id: 'heal',
        intervalTicks: 5,
        nextTick: 0,
        chargesRemaining: 1,
        targetPolicy: 'self',
        payload: {
          kind: 'heal',
          amount: 8,
          radius: 60,
          cleanse: ['burn'],
        },
      },
      {
        id: 'spawn',
        intervalTicks: 5,
        nextTick: 0,
        chargesRemaining: 1,
        targetPolicy: 'self',
        payload: {
          kind: 'spawn',
          unitType: 'marine',
          count: 2,
          cap: 2,
          hpPercent: 0.5,
          spreadRadius: 20,
        },
      },
      {
        id: 'mark',
        intervalTicks: 5,
        nextTick: 0,
        chargesRemaining: 1,
        targetPolicy: 'nearest_air',
        canTargetAir: true,
        payload: {
          kind: 'mark',
          mark: { duration: 8, damageMultiplier: 0.2, focusPriority: 500 },
        },
      },
    ]
    const ally = unit('ally', 'attacker', 130)
    ally.hp = Math.max(1, ally.maxHp - 15)
    ally.statusEffects.push(normalizeStatusEffect({ type: 'burn', duration: 10 }))
    const ground = unit('ground', 'defender', 160)
    const secondary = unit('secondary', 'defender', 190)
    const air = unit('air', 'defender', 220)
    air.isFlying = true
    const ecs = createEcsCombatRuntime()
    for (const candidate of [source, ally, secondary, air, ground]) {
      ecs.world.queueUnitCreation(structuredClone(candidate))
    }
    ecs.flushStructuralCommands()
    const ecsActions: BattleAction[] = []

    ecs.runPeriodicAbilityPhase(0, ecsActions, new PRNG(7))

    expect(ecsActions.filter(action => action.type === 'periodic_ability'))
      .toHaveLength(7)
    expect(ecs.snapshotUnits().filter(candidate =>
      candidate.summonOwnerId === 'source',
    )).toHaveLength(2)
    expect(ecs.world.snapshotHazards()).toContainEqual(expect.objectContaining({
      type: 'napalm',
      id: 'periodic_source_hazard_0',
    }))
  })

  it('owns scheduler charges in canonical support state', () => {
    const world = new CombatWorld([
      unit('source', 'attacker', 100),
      unit('target', 'defender', 160),
    ])
    const spatial = new EntitySpatialIndex()
    world.resources.set('entitySpatial', spatial)
    world.resources.set('rng', new PRNG(3))
    world.stores.support.require(0).periodicAbilities = [{
      id: 'pulse',
      intervalTicks: 4,
      nextTick: 0,
      chargesRemaining: 1,
      targetPolicy: 'nearest_enemy',
      payload: { kind: 'status', effects: [{ type: 'slow', duration: 3 }] },
    }]
    spatial.rebuild(world)
    const actions: BattleAction[] = []

    runEcsPeriodicAbilitySystem(world, 0, actions)

    expect(world.stores.support.require(0).periodicAbilities?.[0])
      .toMatchObject({ nextTick: 4, chargesRemaining: 0 })
    expect(actions[0]).toMatchObject({
      unitId: 'source',
      type: 'periodic_ability',
      targetId: 'target',
    })
  })

  it('rejects an out-of-range current target before spending a charge', () => {
    const world = new CombatWorld([
      unit('source', 'attacker', 100),
      unit('target', 'defender', 300),
    ])
    const spatial = new EntitySpatialIndex()
    world.resources.set('entitySpatial', spatial)
    world.resources.set('rng', new PRNG(5))
    world.stores.support.require(0).periodicAbilities = [{
      id: 'limited',
      intervalTicks: 4,
      nextTick: 0,
      chargesRemaining: 1,
      targetPolicy: 'current_target',
      maxRange: 100,
      payload: { kind: 'damage', amount: 5 },
    }]
    world.stores.entityTargets.require(0).attackTarget = 1
    spatial.rebuild(world)
    const actions: BattleAction[] = []

    runEcsPeriodicAbilitySystem(world, 0, actions)

    expect(actions).toEqual([])
    expect(world.stores.support.require(0).periodicAbilities?.[0])
      .toMatchObject({ nextTick: 0, chargesRemaining: 1 })
  })

  it('does not overwrite canonical periodic inputs from facades', () => {
    const source = unit('canonical-source', 'attacker', 100)
    source.periodicAbilities = [{
      id: 'canonical-pulse',
      intervalTicks: 4,
      nextTick: 0,
      chargesRemaining: 1,
      targetPolicy: 'nearest_enemy',
      maxRange: 100,
      payload: { kind: 'status', effects: [{ type: 'slow', duration: 3 }] },
    }]
    const target = unit('canonical-target', 'defender', 160)
    const runtime = createEcsCombatRuntime()
    runtime.world.queueUnitCreation(source, target)
    runtime.flushStructuralCommands()
    source.periodicAbilities = undefined
    source.x = 700
    target.x = 950
    target.statusEffects = [normalizeStatusEffect({
      type: 'burn',
      duration: 20,
    })]
    const actions: BattleAction[] = []

    runtime.runPeriodicAbilityPhase(0, actions, new PRNG(11))

    const sourceId = runtime.world.getEntityId(source.id)!
    const targetId = runtime.world.getEntityId(target.id)!
    expect(actions).toContainEqual(expect.objectContaining({
      unitId: 'canonical-source',
      type: 'periodic_ability',
      targetId: 'canonical-target',
    }))
    expect(runtime.world.stores.support.require(sourceId)
      .periodicAbilities?.[0]).toMatchObject({
        nextTick: 4,
        chargesRemaining: 0,
      })
    expect(runtime.world.stores.statusControl.require(targetId).statusEffects)
      .toEqual([expect.objectContaining({ type: 'slow' })])
  })
})
