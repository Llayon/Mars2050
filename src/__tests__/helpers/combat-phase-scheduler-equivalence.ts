import type { BattleAction } from '@/domains/combat/combat.actions'
import type { BattleOutcome } from '@/domains/combat/combat.outcome'
import type { CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import type { CombatPhaseStage, RuntimePhaseContext } from '@/domains/combat/combat.phase'
import { getEcsPhaseOrder } from '@/domains/combat/ecs/combat-phase-scheduler'
import { drainV9FollowUps } from '@/domains/combat/ecs/v9-follow-up-queue'
import type { EcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { normalizeCommittedActions } from './combat-movement-pipeline-diagnostics'
import { prepareMovementProbeWorld, type PreparedWorld } from './combat-movement-pipeline-advancement'
import {
  canonicalSerialize,
  captureSemanticStateSnapshot,
  compareSemanticStates,
} from './combat-semantic-state-diff'
import type { OrderingProbeResult } from './combat-ordering-probes'
import type { Stage0Checkpoint } from './combat-movement-pipeline-types'

export interface SchedulerEquivalenceResult {
  equivalent: boolean
  productionStateRuntime: EcsCombatRuntime
  manualStateRuntime: EcsCombatRuntime
  productionState: Stage0Checkpoint
  manualState: Stage0Checkpoint
  productionActions: Record<string, unknown>[]
  manualActions: Record<string, unknown>[]
  productionTerminal: BattleOutcome | null
  manualTerminal: BattleOutcome | null
}

export function validateSchedulerEquivalence(
  scenario: CombatBalanceScenario,
  seed: number,
  probe: OrderingProbeResult,
): SchedulerEquivalenceResult {
  const production = executeTick0Production(scenario, seed, probe)
  const manual = executeTick0Manual(scenario, seed, probe)
  const productionState = captureSemanticStateSnapshot(production.runtime, probe)
  const manualState = captureSemanticStateSnapshot(manual.runtime, probe)
  const stateEquivalent = compareSemanticStates(productionState, manualState).equivalent
  const actionsEquivalent = canonicalSerialize(production.actions) === canonicalSerialize(manual.actions)
  const terminalEquivalent = canonicalSerialize(production.terminal) === canonicalSerialize(manual.terminal)
  const resourceEquivalent = canonicalSerialize(resourceFingerprint(production.runtime)) === canonicalSerialize(resourceFingerprint(manual.runtime))
  return {
    equivalent: stateEquivalent && actionsEquivalent && terminalEquivalent && resourceEquivalent,
    productionStateRuntime: production.runtime,
    manualStateRuntime: manual.runtime,
    productionState, manualState,
    productionActions: normalizeCommittedActions(production.actions, probe),
    manualActions: normalizeCommittedActions(manual.actions, probe),
    productionTerminal: production.terminal, manualTerminal: manual.terminal,
  }
}

function executeTick0Production(scenario: CombatBalanceScenario, seed: number, probe: OrderingProbeResult): TickExecution {
  const prepared = prepareMovementProbeWorld(scenario, seed, probe)
  const context = makeContext(prepared, 0)
  prepared.runtime.runStage('pre_action', context)
  const terminal = prepared.runtime.getTerminalOutcome()
  if (!terminal) {
    prepared.runtime.runStage('action', context)
    prepared.runtime.runStage('post_action', context)
  }
  return { runtime: prepared.runtime, actions: context.actions, terminal }
}

function executeTick0Manual(scenario: CombatBalanceScenario, seed: number, probe: OrderingProbeResult): TickExecution {
  const prepared = prepareMovementProbeWorld(scenario, seed, probe)
  const context = makeContext(prepared, 0)
  runManualStage(prepared.runtime, 'pre_action', context)
  const terminal = prepared.runtime.getTerminalOutcome()
  if (!terminal) {
    runManualStage(prepared.runtime, 'action', context)
    runManualStage(prepared.runtime, 'post_action', context)
  }
  return { runtime: prepared.runtime, actions: context.actions, terminal }
}

function runManualStage(runtime: EcsCombatRuntime, stage: CombatPhaseStage, context: RuntimePhaseContext): void {
  for (const phaseId of getEcsPhaseOrder(stage)) {
    runtime.runPhase(phaseId, context)
    drainV9FollowUps(runtime.world, context)
  }
}

function makeContext(prepared: PreparedWorld, tick: number): RuntimePhaseContext {
  const actions: BattleAction[] = []
  prepared.runtime.world.resources.require('clock').tick = tick
  prepared.runtime.world.resources.set('actions', actions)
  return { tick, actions, rng: prepared.rng, activeGlobals: [] }
}

interface TickExecution {
  runtime: EcsCombatRuntime
  actions: BattleAction[]
  terminal: BattleOutcome | null
}

function resourceFingerprint(runtime: EcsCombatRuntime): Record<string, unknown> {
  return {
    clock: runtime.world.resources.require('clock'),
    obstacles: runtime.world.resources.require('obstacles'),
    dirtySpatialEntities: [...runtime.world.resources.require('dirtySpatialEntities')],
    movementRequestCount: runtime.world.resources.get('movementRequests')?.length ?? 0,
    followUpCount: runtime.world.resources.require('v9FollowUps').length,
  }
}
