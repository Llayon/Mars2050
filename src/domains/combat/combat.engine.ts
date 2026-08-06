import { MAX_TICKS } from './combat.config'
import { GLOBAL_UPGRADES, type GlobalUpgradeConfig } from './combat.upgrades'
import type { UnitRow, BattleAction, BattleTick, BattleResult } from './combat.types'
import type { Team, Obstacle } from './combat.sim.types'
import { createCombatMetrics, finalizeCombatMetrics, recordCombatActions, recordCombatTick, type BattleSimulationOptions } from './combat.metrics'
import { PRNG, generateObstacles } from './combat.utils'
import { createPathfindingMap } from './combat.pathfinding'
import { getTimeoutOutcome, type BattleOutcome } from './combat.outcome'
import { CURRENT_SIMULATION_REVISION, CURRENT_SIMULATION_VERSION, V8_SIMULATION_REVISION, V8_SIMULATION_VERSION, V9_SIMULATION_REVISION, V9_SIMULATION_VERSION } from './combat.version'
import { createEcsCombatRuntime } from './ecs/combat-ecs-runtime'
export function simulateBattle(attackerUnits: UnitRow[], defenderUnits: UnitRow[], providedSeed?: number, providedObstacles?: Obstacle[], attackerGlobals: string[] = [], defenderGlobals: string[] = [], options: BattleSimulationOptions = {}): BattleResult {
  const seed = providedSeed ?? Date.now(), rng = new PRNG(seed), dt = 0.1
  const maxTicks = normalizeMaxTicks(options.maxTicks)
  const timeoutPolicy = options.timeoutPolicy ?? 'draw'
  const defenseResolutionMode = options.defenseResolutionMode ?? 'v8_sequential'
  const runtime = createEcsCombatRuntime({ profile: options.profile === true, defenseResolutionMode })
  const activeGlobals: { team: Team, upg: GlobalUpgradeConfig }[] = []
  attackerGlobals.forEach(id => { if (GLOBAL_UPGRADES[id]) activeGlobals.push({ team: 'attacker', upg: GLOBAL_UPGRADES[id] }) })
  defenderGlobals.forEach(id => { if (GLOBAL_UPGRADES[id]) activeGlobals.push({ team: 'defender', upg: GLOBAL_UPGRADES[id] }) })
  const obstacles: Obstacle[] = providedObstacles || generateObstacles(seed);
  const flowFieldMap = createPathfindingMap(obstacles)
  attackerUnits.forEach(row => runtime.addSquad(row, 'attacker', rng))
  defenderUnits.forEach(row => runtime.addSquad(row, 'defender', rng))

  const initialState = runtime.snapshotUnits()
  const metrics = options.trackMetrics ? createCombatMetrics(runtime.world) : undefined

  const resources = runtime.world.resources
  resources.set('clock', { tick: 0, dt, maxTicks, timeoutPolicy })
  resources.set('rng', rng)
  resources.set('actions', [])
  resources.set('obstacles', obstacles)
  resources.set('flowField', flowFieldMap)
  resources.set('globals', activeGlobals)
  resources.set('metrics', metrics)

  const logs: BattleTick[] = []
  let tick = 0, resolvedOutcome: BattleOutcome | null = null

  while (tick < maxTicks) {
    const actions: BattleAction[] = []
    runtime.world.resources.require('clock').tick = tick
    runtime.world.resources.set('actions', actions)
    runtime.runStage('pre_action', { tick, actions, rng, activeGlobals })

    const terminalOutcome = runtime.getTerminalOutcome()
    if (terminalOutcome) { resolvedOutcome = terminalOutcome; break }

    runtime.runStage('action', { tick, actions, rng, activeGlobals })

    runtime.runStage('post_action', { tick, actions, rng, activeGlobals });
    if (metrics) {
      recordCombatActions(metrics, tick, actions, runtime.world)
      recordCombatTick(metrics, runtime.world)
    }
    
    if (actions.length > 0) logs.push({ tick, actions })
    
    tick++
  }

  const outcome = resolvedOutcome ?? getTimeoutOutcome(timeoutPolicy)

  return {
    winner: outcome.winner,
    logs,
    seed,
    initialState,
    survivors: runtime.getSurvivors(),
    obstacles,
    metrics: metrics ? finalizeCombatMetrics(metrics, tick) : undefined,
    terminationReason: outcome.reason,
    elapsedTicks: tick,
    simulationVersion: defenseResolutionMode === 'v8_sequential' ? V8_SIMULATION_VERSION : V9_SIMULATION_VERSION,
    simulationRevision: defenseResolutionMode === 'v8_sequential' ? V8_SIMULATION_REVISION : V9_SIMULATION_REVISION,
    profile: options.profile
      ? runtime.world.resources.require('entitySpatial').getProfile(runtime.world)
      : undefined,
  }
}

function normalizeMaxTicks(value?: number): number {
  if (value === undefined || !Number.isFinite(value)) return MAX_TICKS
  return Math.max(1, Math.min(2000, Math.floor(value)))
}
