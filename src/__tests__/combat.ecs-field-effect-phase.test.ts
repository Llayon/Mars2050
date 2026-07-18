import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { applyStatus } from '@/domains/combat/combat.status'
import { createLegacyCombatRuntime } from '@/domains/combat/combat.legacy-runtime'
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
  it('matches legacy cleanse, barrier, and hazard scheduling', () => {
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
    applyStatus(ally, { type: 'burn', duration: 20 })
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
    const legacy = createLegacyCombatRuntime()
    const ecs = createEcsCombatRuntime()
    for (const candidate of [emitter, ally]) {
      legacy.units.push(structuredClone(candidate))
      ecs.units.push(structuredClone(candidate))
    }
    legacy.hazards.push(structuredClone(fire))
    ecs.hazards.push(structuredClone(fire))
    ecs.flushStructuralCommands()
    const legacyActions: BattleAction[] = []
    const ecsActions: BattleAction[] = []

    legacy.runFieldEffectPhase(0, legacyActions)
    ecs.runFieldEffectPhase(0, ecsActions)
    legacy.runFieldEffectPhase(1, legacyActions)
    ecs.runFieldEffectPhase(1, ecsActions)

    expect(ecsActions).toEqual(legacyActions)
    expect(ecs.snapshotUnits()).toEqual(legacy.snapshotUnits())
    expect(ecs.hazards).toEqual(legacy.hazards)
    expect(ecsActions.filter(action => action.type === 'field_effect')).toHaveLength(3)
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
    }
    const actions: BattleAction[] = []

    expect(world.roster.every(candidate => !candidate.fieldEffect)).toBe(true)
    runEcsFieldEffectSystem(world, 0, actions)

    expect(actions.filter(action => action.type === 'field_effect')
      .map(action => action.unitId)).toEqual(['alpha', 'zeta'])
    expect(world.stores.support.require(0).fieldEffect?.[0].nextTick).toBe(5)
    expect(world.hazards.map(hazard => hazard.id)).toEqual([
      'barrier_alpha_barrier_0',
      'barrier_zeta_barrier_0',
    ])
  })
})
