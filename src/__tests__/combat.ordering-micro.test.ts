import { describe, expect, it } from 'vitest'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { createConfiguredUnitEntity } from '@/domains/combat/ecs/combat-entity-factory'
import { getEcsSteeringContext } from '@/domains/combat/ecs/movement-steering'
import { createEcsMeleeEngagementState, reserveEcsMeleeSlot } from '@/domains/combat/ecs/systems/melee-engagement-system'
import { runTargetingSystem } from '@/domains/combat/ecs/systems/targeting-system'
import { getSizeRadius } from '@/domains/combat/combat.utils'
import type { RuntimeUnitFactoryInput } from '@/domains/combat/combat.unit-build.types'
import { TIER1_BALANCE_SCENARIOS } from '@/domains/combat/combat.tier1-scenarios'
import { applyOrderingProbe } from './helpers/combat-ordering-probes'
import { captureInitialPlanningSnapshot, firstPlanningDivergence } from './helpers/combat-ordering-runtime-probes'

describe('ordering mechanism boundaries', () => {
  it('captures initial semantic planning and reservation ownership', () => {
    const scenario = TIER1_BALANCE_SCENARIOS.find(item => item.id === 'tier1_heavy_gunner_sustained_line')!
    const baseline = captureInitialPlanningSnapshot(applyOrderingProbe(scenario, 'baseline'), 101)
    const reassigned = captureInitialPlanningSnapshot(applyOrderingProbe(scenario, 'defender_cohort_rank_reassigned'), 101)
    expect(baseline.records.length).toBeGreaterThan(0)
    expect(firstPlanningDivergence(baseline, baseline)).toBeNull()
    expect(firstPlanningDivergence(baseline, reassigned)).not.toBeNull()
  })

  it('characterizes processing-order-sensitive reservation with a free-capacity control', () => {
    const contention = runReservationMicro(false)
    expect(runReservationMicro(true)).not.toEqual(contention)
    const free = runReservationMicro(false, false)
    expect(runReservationMicro(true, false)).toEqual(free)
  })

  it('characterizes lexical ownership for an exact target tie', () => {
    const baseline = runTargetTieMicro(false)
    const renamed = runTargetTieMicro(true)
    expect(baseline.selectedSemantic).toBe('left')
    expect(renamed.selectedSemantic).toBe('right')
    expect(renamed.idSet).toEqual(baseline.idSet)
    expect(renamed.candidateOrder).toEqual(baseline.candidateOrder)
  })

  it('characterizes residual raw-ID steering at exact overlap', () => {
    expect(runSteeringOverlapMicro(true).separation).not.toEqual(runSteeringOverlapMicro(false).separation)
  })
})

function runReservationMicro(reverse: boolean, saturated = true): Record<string, { slot: number | null; waiting: string | null }> {
  const runtime = createEcsCombatRuntime()
  const count = saturated ? 8 : 2
  const actors = Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2
    return { id: `micro-actor-${index}`, team: 'attacker' as const, type: 'shock_trooper', x: 300 + Math.cos(angle) * 95, y: 300 + Math.sin(angle) * 95, currentAngle: angle }
  })
  const inputs: RuntimeUnitFactoryInput[] = [
    ...actors,
    { id: 'micro-reservation-target', team: 'defender', type: 'light_walker', x: 300, y: 300, currentAngle: 0, hp: 1000 },
  ]
  for (const input of inputs) createConfiguredUnitEntity(runtime.world, input)
  runtime.world.resources.require('entitySpatial').ensureCurrent(runtime.world)
  const targeting = runtime.world.resources.require('targetingRuntime')
  const melee = createEcsMeleeEngagementState()
  const output: Record<string, { slot: number | null; waiting: string | null }> = {}
  targeting.begin(runtime.world)
  try {
    for (const actor of reverse ? [...actors].reverse() : actors) {
      const entityId = runtime.world.getEntityId(actor.id)
      if (entityId === undefined) throw new Error(`Missing micro actor ${actor.id}`)
      const targetId = runTargetingSystem(runtime.world, entityId, melee, targeting)
      if (targetId !== null) reserveEcsMeleeSlot(runtime.world, entityId, targetId, melee)
      const waitingId = runtime.world.stores.entityTargets.require(entityId).meleeWaitingTarget
      output[actor.id] = {
        slot: runtime.world.stores.targeting.require(entityId).meleeSlotIndex ?? null,
        waiting: waitingId === undefined ? null : runtime.world.stores.identity.require(waitingId).id,
      }
    }
  } finally {
    targeting.end()
  }
  return output
}

function runTargetTieMicro(swapped: boolean): { selectedSemantic: string; idSet: string[]; candidateOrder: string[] } {
  const runtime = createEcsCombatRuntime()
  const leftId = swapped ? 'tie-b' : 'tie-a'
  const rightId = swapped ? 'tie-a' : 'tie-b'
  createConfiguredUnitEntity(runtime.world, { id: 'tie-attacker', team: 'attacker', type: 'marine', x: 300, y: 300, currentAngle: 0 })
  createConfiguredUnitEntity(runtime.world, { id: leftId, team: 'defender', type: 'marine', x: 220, y: 300, currentAngle: Math.PI })
  createConfiguredUnitEntity(runtime.world, { id: rightId, team: 'defender', type: 'marine', x: 380, y: 300, currentAngle: Math.PI })
  runtime.world.resources.require('entitySpatial').ensureCurrent(runtime.world)
  const targeting = runtime.world.resources.require('targetingRuntime')
  targeting.begin(runtime.world)
  try {
    const attacker = runtime.world.getEntityId('tie-attacker')
    if (attacker === undefined) throw new Error('Missing tie attacker')
    const selected = runTargetingSystem(runtime.world, attacker, createEcsMeleeEngagementState(), targeting)
    if (selected === null) throw new Error('Target tie selected no target')
    return {
      selectedSemantic: runtime.world.stores.identity.require(selected).id === leftId ? 'left' : 'right',
      idSet: [leftId, rightId].sort(compareCodeUnit),
      candidateOrder: ['left', 'right'],
    }
  } finally {
    targeting.end()
  }
}

function runSteeringOverlapMicro(renamed: boolean): { separation: { x: number; y: number } } {
  const runtime = createEcsCombatRuntime()
  const firstId = renamed ? 'probe-a-0000' : 'steer-a'
  const secondId = renamed ? 'probe-a-0001' : 'steer-b'
  createConfiguredUnitEntity(runtime.world, { id: firstId, team: 'attacker', type: 'shock_trooper', x: 300, y: 300, currentAngle: 0 })
  createConfiguredUnitEntity(runtime.world, { id: secondId, team: 'defender', type: 'shock_trooper', x: 300, y: 300, currentAngle: Math.PI })
  const first = runtime.world.getEntityId(firstId)
  const second = runtime.world.getEntityId(secondId)
  if (first === undefined || second === undefined) throw new Error('Missing steering overlap entities')
  const context = getEcsSteeringContext(runtime.world, first, [second], getSizeRadius(runtime.world.stores.transform.require(first).size), false)
  return { separation: { x: context.separationX, y: context.separationY } }
}

function compareCodeUnit(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
