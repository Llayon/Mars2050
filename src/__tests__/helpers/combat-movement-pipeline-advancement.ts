import type { BattleAction } from '@/domains/combat/combat.actions'
import type { CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import type { RuntimePhaseContext } from '@/domains/combat/combat.phase'
import { PRNG } from '@/domains/combat/combat.utils'
import { createPathfindingMap } from '@/domains/combat/combat.pathfinding'
import { createEcsCombatRuntime, type EcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import type { OrderingProbeResult } from './combat-ordering-probes'

export interface PreparedWorld {
  runtime: EcsCombatRuntime
  rng: PRNG
  actions: BattleAction[]
}

export function prepareMovementProbeWorld(scenario: CombatBalanceScenario, seed: number, probe: OrderingProbeResult): PreparedWorld {
  const runtime = createEcsCombatRuntime({ defenseResolutionMode: 'v9_snapshot' })
  const rng = new PRNG(seed)
  for (const row of probe.attackers) runtime.addSquad(row, 'attacker', rng)
  for (const row of probe.defenders) runtime.addSquad(row, 'defender', rng)
  const actions: BattleAction[] = []
  runtime.world.resources.set('clock', { tick: 0, dt: 0.1, maxTicks: 2000, timeoutPolicy: 'draw' })
  runtime.world.resources.set('rng', rng)
  runtime.world.resources.set('actions', actions)
  runtime.world.resources.set('obstacles', [])
  runtime.world.resources.set('flowField', createPathfindingMap([]))
  runtime.world.resources.set('globals', [])
  runtime.world.resources.set('metrics', undefined)
  runtime.flushStructuralCommands()
  if (scenario.id.length === 0) throw new Error('Movement probe scenario ID is required')
  return { runtime, rng, actions }
}

export function advanceToPreBatchCheckpoint(scenario: CombatBalanceScenario, seed: number, probe: OrderingProbeResult, targetTick: number): PreparedWorld & { context: RuntimePhaseContext } {
  if (!Number.isInteger(targetTick) || targetTick < 0) throw new Error('TARGET_TICK_UNREACHABLE')
  const prepared = prepareMovementProbeWorld(scenario, seed, probe)
  if (targetTick >= prepared.runtime.world.resources.require('clock').maxTicks) throw new Error('TARGET_TICK_UNREACHABLE')
  const activeGlobals: NonNullable<RuntimePhaseContext['activeGlobals']> = []
  for (let tick = 0; tick < targetTick; tick++) {
    const actions: BattleAction[] = []
    prepared.runtime.world.resources.require('clock').tick = tick
    prepared.runtime.world.resources.set('actions', actions)
    const context: RuntimePhaseContext = { tick, actions, rng: prepared.rng, activeGlobals }
    prepared.runtime.runStage('pre_action', context)
    if (prepared.runtime.getTerminalOutcome()) throw new Error('TARGET_TICK_UNREACHABLE')
    prepared.runtime.runStage('action', context)
    prepared.runtime.runStage('post_action', context)
  }
  const actions: BattleAction[] = []
  prepared.runtime.world.resources.require('clock').tick = targetTick
  prepared.runtime.world.resources.set('actions', actions)
  const context: RuntimePhaseContext = { tick: targetTick, actions, rng: prepared.rng, activeGlobals }
  prepared.runtime.runStage('pre_action', context)
  if (prepared.runtime.getTerminalOutcome()) throw new Error('TARGET_TICK_UNREACHABLE')
  prepared.runtime.runStage('action', context)
  return { ...prepared, actions, context }
}

export function advanceToPreActorTurnCheckpoint(scenario: CombatBalanceScenario, seed: number, probe: OrderingProbeResult, targetTick: number): PreparedWorld & { context: RuntimePhaseContext } {
  if (!Number.isInteger(targetTick) || targetTick < 0) throw new Error('TARGET_TICK_UNREACHABLE')
  const prepared = prepareMovementProbeWorld(scenario, seed, probe)
  if (targetTick >= prepared.runtime.world.resources.require('clock').maxTicks) throw new Error('TARGET_TICK_UNREACHABLE')
  const activeGlobals: NonNullable<RuntimePhaseContext['activeGlobals']> = []
  for (let tick = 0; tick < targetTick; tick++) {
    const actions: BattleAction[] = []
    prepared.runtime.world.resources.require('clock').tick = tick
    prepared.runtime.world.resources.set('actions', actions)
    const context: RuntimePhaseContext = { tick, actions, rng: prepared.rng, activeGlobals }
    prepared.runtime.runStage('pre_action', context)
    if (prepared.runtime.getTerminalOutcome()) throw new Error('TARGET_TICK_UNREACHABLE')
    prepared.runtime.runStage('action', context)
    prepared.runtime.runStage('post_action', context)
  }
  const actions: BattleAction[] = []
  prepared.runtime.world.resources.require('clock').tick = targetTick
  prepared.runtime.world.resources.set('actions', actions)
  const context: RuntimePhaseContext = { tick: targetTick, actions, rng: prepared.rng, activeGlobals }
  prepared.runtime.runStage('pre_action', context)
  if (prepared.runtime.getTerminalOutcome()) throw new Error('TARGET_TICK_UNREACHABLE')
  return { ...prepared, actions, context }
}
