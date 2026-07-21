import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { normalizeStatusEffect } from '@/domains/combat/combat.status-core'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { runEcsFieldEffectSystem } from '@/domains/combat/ecs/systems'

function unit(id: string, x = 100): SimUnit {
  return createRuntimeUnitFromConfig({
    id,
    team: 'attacker',
    type: 'marine',
    x,
    y: 500,
    currentAngle: 0,
  })!
}

describe('combat ECS field effect phase', () => {
  it('cleanses, creates barriers, and schedules hazards', () => {
    const emitter = unit('emitter')
    emitter.fieldEffect = [
      {
        id: 'cleanse',
        kind: 'cleanse_field',
        radius: 120,
        intervalTicks: 10,
        nextTick: 0,
        hazardTypes: ['napalm'],
      },
      {
        id: 'barrier',
        kind: 'barrier_dome',
        radius: 100,
        intervalTicks: 10,
        nextTick: 0,
        duration: 12,
        capacity: 60,
      },
      {
        id: 'smoke',
        kind: 'hazard_field',
        hazardType: 'smoke',
        radius: 90,
        intervalTicks: 10,
        nextTick: 0,
        duration: 20,
      },
    ]
    const ally = unit('ally', 140)
    ally.statusEffects.push(normalizeStatusEffect({ type: 'burn', duration: 20 }))
    const fire = {
      id: 'fire',
      team: 'defender' as const,
      type: 'napalm' as const,
      x: 120,
      y: 500,
      radius: 40,
      damagePerTick: 2,
      duration: 20,
    }
    const ecs = createEcsCombatRuntime()
    for (const candidate of [emitter, ally]) {
      ecs.world.queueUnitCreation(structuredClone(candidate))
    }
    ecs.world.queueHazardCreation(structuredClone(fire))
    ecs.flushStructuralCommands()
    const ecsActions: BattleAction[] = []

    ecs.runPhase('field_effect', { tick: 0, actions: ecsActions })
    ecs.runPhase('field_effect', { tick: 1, actions: ecsActions })

    expect(ecsActions.filter(action => action.type === 'field_effect')).toHaveLength(3)
    expect(ecs.world.stores.statusControl.require(1).statusEffects).toEqual([])
    expect(ecs.world.snapshotHazards().map(hazard => hazard.type).sort()).toEqual(['barrier_dome', 'smoke'])
  })

  it('reads scheduler state from canonical stores in external-ID order', () => {
    const world = new CombatWorld([unit('zeta'), unit('alpha')])
    for (const entityId of [0, 1]) {
      world.stores.support.require(entityId).fieldEffect = [{
        id: 'barrier',
        kind: 'barrier_dome',
        radius: 80,
        intervalTicks: 5,
        nextTick: 0,
        duration: 5,
        capacity: 20,
      }]
      world.setUnitCapability(entityId, 'fieldEffectCapability', true)
    }
    const actions: BattleAction[] = []

    runEcsFieldEffectSystem(world, 0, actions)
    world.flushStructuralCommands()

    expect(actions.filter(action => action.type === 'field_effect')
      .map(action => action.unitId)).toEqual(['alpha', 'zeta'])
    expect(world.stores.support.require(0).fieldEffect?.[0].nextTick).toBe(5)
    expect(world.snapshotHazards().map(hazard => hazard.id)).toEqual([
      'barrier_alpha_barrier_0',
      'barrier_zeta_barrier_0',
    ])
  })

  it('does not overwrite canonical field inputs from the facade', () => {
    const emitter = unit('canonical-emitter', 100)
    emitter.fieldEffect = [{
      id: 'canonical-barrier',
      kind: 'barrier_dome',
      radius: 80,
      intervalTicks: 5,
      nextTick: 0,
      duration: 5,
      capacity: 20,
    }]
    const runtime = createEcsCombatRuntime()
    runtime.world.queueUnitCreation(emitter)
    runtime.flushStructuralCommands()
    emitter.x = 900
    emitter.fieldEffect = undefined
    const actions: BattleAction[] = []

    runtime.runPhase('field_effect', { tick: 0, actions })
    runtime.flushStructuralCommands()

    const emitterId = runtime.world.getEntityId(emitter.id)!
    expect(actions).toContainEqual(expect.objectContaining({
      unitId: 'canonical-emitter',
      type: 'field_effect',
    }))
    expect(runtime.world.snapshotHazards()).toContainEqual(expect.objectContaining({
      id: 'barrier_canonical-emitter_canonical-barrier_0',
      x: 100,
      capacity: 20,
    }))
    expect(runtime.world.stores.support.require(emitterId)
      .fieldEffect?.[0].nextTick).toBe(5)
  })
})
