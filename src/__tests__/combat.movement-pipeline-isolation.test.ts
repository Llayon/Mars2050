import { describe, expect, it } from 'vitest'
import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { createConfiguredUnitEntity } from '@/domains/combat/ecs/combat-entity-factory'
import { createMovementFrame } from '@/domains/combat/ecs/movement-frame'
import { solveBatchMovementCollisions } from '@/domains/combat/ecs/movement-collision-solver'
import { applyOrderingProbe } from './helpers/combat-ordering-probes'
import { captureMovementPipelineCell } from './helpers/combat-movement-pipeline-probes'
import { predictCollisionFallbackVector } from './helpers/combat-movement-pipeline-collision'
import type { MovementCell, PipelineCellResult } from './helpers/combat-movement-pipeline-types'
import { assertSemanticIdentityMapping, comparePipelineCells } from './helpers/combat-movement-pipeline-diagnostics'

const SCENARIO_IDS = [
  'tier1_heavy_gunner_sustained_line',
  'tier1_heavy_gunner_exposed',
  'tier1_marine_baseline_duel',
] as const
const SEEDS = [101, 202, 303, 404, 505] as const

describe('combat movement pipeline isolation', () => {
  it('keeps internal identity, stage zero, request multisets, and initiative stable', () => {
    for (const scenario of scenarios()) for (const seed of SEEDS) {
      const pair = captureCells(scenario, seed, 1)
      const all = Object.values(pair)
      for (const cell of all) {
        expect(cell.stage0.entities.map(entity => entity.semanticActor)).toEqual(
          [...cell.stage0.entities].map(entity => entity.semanticActor).sort(compareCodeUnit),
        )
        expect(cell.requests.map(request => request.initiativeIndex).sort((a, b) => a - b)).toEqual(
          pair.BB.requests.map(request => request.initiativeIndex).sort((a, b) => a - b),
        )
        expect(cell.requests.map(request => request.semanticActor).sort(compareCodeUnit)).toEqual(
          pair.BB.requests.map(request => request.semanticActor).sort(compareCodeUnit),
        )
      }
      for (const cell of all.slice(1)) expect(() => assertSemanticIdentityMapping(pair.BB, cell)).not.toThrow()
      expect(pair.BB.requests.map(request => request.executionArrayOrdinal)).toEqual(pair.BB.requests.map((_, index) => index))
      expect(pair.BC.requests.map(request => request.semanticActor).sort(compareCodeUnit)).toEqual(
        pair.BB.requests.map(request => request.semanticActor).sort(compareCodeUnit),
      )
      expect(pair.CC.requests.map(request => request.semanticActor).sort(compareCodeUnit)).toEqual(
        pair.CB.requests.map(request => request.semanticActor).sort(compareCodeUnit),
      )
    }
  }, 120_000)

  it('round-trips the request reorder without dropping, duplicating, or rewriting initiative', () => {
    const scenario = scenarioById('tier1_heavy_gunner_sustained_line')
    const pair = captureCells(scenario, 101, 1)
    const baselineByActor = new Map(pair.BB.requests.map(request => [request.semanticActor, request]))
    expect(pair.BC.requests.map(request => request.semanticActor)).toEqual(pair.CC.requests.map(request => request.semanticActor))
    expect(pair.BC.requests.map(request => request.semanticActor).sort(compareCodeUnit)).toEqual([...baselineByActor.keys()].sort(compareCodeUnit))
    for (const request of pair.BC.requests) {
      const original = baselineByActor.get(request.semanticActor)
      expect(original).toBeDefined()
      expect(request.kind).toBe(original?.kind)
      expect(request.semanticTarget).toBe(original?.semanticTarget)
      expect(request.initiativeIndex).toBe(original?.initiativeIndex)
      expect(request.payload).toEqual(original?.payload)
    }
    expect(pair.BC.requests.map(request => request.executionArrayOrdinal)).toEqual(
      pair.BC.requests.map((_, index) => index),
    )
  })

  it('uses independent fresh worlds and keeps repeated authoritative commit deterministic', () => {
    const scenario = scenarioById('tier1_marine_baseline_duel')
    const first = captureCells(scenario, 101, 1)
    const second = captureCells(scenario, 101, 1)
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    for (const cell of Object.values(first)) {
      expect(cell.stage0.clock.tick).toBe(1)
      const assessment = comparePipelineCells(cell, cell)
      expect(assessment.mechanism).toBe('NO_DIVERGENCE')
      expect(assessment.stageSpecificEffect).toBe('none')
      for (const intent of cell.intents) {
        expect(Number.isFinite(intent.fromX)).toBe(true)
        expect(Number.isFinite(intent.toX)).toBe(true)
        expect(Number.isFinite(intent.facingAngle)).toBe(true)
      }
      for (const overlap of cell.preSolverExactCollisionPairs) expect(overlap.distanceSquared).toBe(0)
      for (const overlap of cell.exactSteeringPairs) expect(overlap.distanceSquared).toBe(0)
    }
  })

  it('keeps the tick-zero heavy control free of movement-pipeline divergence', () => {
    const pair = captureCells(scenarioById('tier1_heavy_gunner_sustained_line'), 101, 0)
    expect(Object.values(pair).every(cell => cell.targetTick === 0)).toBe(true)
    for (const cell of Object.values(pair)) {
      const assessment = comparePipelineCells(pair.BB, cell)
      expect(assessment.stageComparison.intentEquivalent).toBe(true)
      expect(assessment.stageComparison.collisionEquivalent).toBe(true)
      expect(assessment.stageComparison.committedEquivalent).toBe(true)
    }
  })

  it('rejects an unreachable target tick explicitly', () => {
    const scenario = scenarioById('tier1_heavy_gunner_sustained_line')
    const probe = applyOrderingProbe(scenario, 'baseline')
    expect(() => captureMovementPipelineCell(scenario, 101, 'BB', probe, 2000)).toThrow('TARGET_TICK_UNREACHABLE')
  })

  it('self-validates the test-only collision fallback vector against the production solver', () => {
    for (const swapped of [false, true]) {
      const runtime = createEcsCombatRuntime({ defenseResolutionMode: 'v9_snapshot' })
      const firstExternalId = swapped ? 'collision-b' : 'collision-a'
      const secondExternalId = swapped ? 'collision-a' : 'collision-b'
      createConfiguredUnitEntity(runtime.world, { id: firstExternalId, team: 'attacker', type: 'shock_trooper', x: 300, y: 300, currentAngle: 0 })
      createConfiguredUnitEntity(runtime.world, { id: secondExternalId, team: 'defender', type: 'shock_trooper', x: 300, y: 300, currentAngle: Math.PI })
      runtime.world.flushStructuralCommands()
      const firstId = runtime.world.getEntityId(firstExternalId)
      const secondId = runtime.world.getEntityId(secondExternalId)
      if (firstId === undefined || secondId === undefined) throw new Error('Missing collision micro entity')
      const frame = createMovementFrame(runtime.world)
      const result = solveBatchMovementCollisions(runtime.world, frame, [], new Set(frame.entityIds))
      const predicted = predictCollisionFallbackVector(firstExternalId, secondExternalId)
      const actual = {
        x: result.x[secondId]! - frame.transforms[secondId]!.x,
        y: result.y[secondId]! - frame.transforms[secondId]!.y,
      }
      const magnitude = Math.hypot(actual.x, actual.y)
      expect(magnitude).toBeGreaterThan(0)
      expect((actual.x / magnitude) * predicted.x + (actual.y / magnitude) * predicted.y).toBeGreaterThan(0.99)
    }
  })
})

function captureCells(scenario: CombatBalanceScenario, seed: number, targetTick: number): Record<MovementCell, PipelineCellResult> {
  const baselineProbe = applyOrderingProbe(scenario, 'baseline')
  const candidateProbe = applyOrderingProbe(scenario, 'defender_cohort_rank_reassigned')
  const bb = captureMovementPipelineCell(scenario, seed, 'BB', baselineProbe, targetTick)
  const candidateProduction = captureMovementPipelineCell(scenario, seed, 'CC', candidateProbe, targetTick)
  const semanticOrder = candidateProduction.requests.map(request => request.semanticActor)
  const baselineOrder = bb.requests.map(request => request.semanticActor)
  const bc = captureMovementPipelineCell(scenario, seed, 'BC', baselineProbe, targetTick, semanticOrder)
  const cb = captureMovementPipelineCell(scenario, seed, 'CB', candidateProbe, targetTick, baselineOrder)
  const cc = captureMovementPipelineCell(scenario, seed, 'CC', candidateProbe, targetTick, semanticOrder)
  return { BB: bb, BC: bc, CB: cb, CC: cc }
}

function scenarios(): CombatBalanceScenario[] { return SCENARIO_IDS.map(scenarioById) }
function scenarioById(id: string): CombatBalanceScenario {
  const scenario = TIER1_BALANCE_SCENARIOS.find(item => item.id === id)
  if (!scenario) throw new Error(`Missing movement isolation scenario ${id}`)
  return scenario
}
function compareCodeUnit(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0 }
