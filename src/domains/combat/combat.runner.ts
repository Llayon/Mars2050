import type { BattleInput, CombatRunResult } from '@mars2050/combat-core/contracts'
import { PRNG } from '@mars2050/combat-core/math'
import { createEcsCombatRuntime } from './ecs/combat-ecs-runtime'
import { createPathfindingMap } from './combat.pathfinding'
import { getTimeoutOutcome, type BattleOutcome } from './combat.outcome'
import { V8_SIMULATION_REVISION, V8_SIMULATION_VERSION, V9_SIMULATION_REVISION, V9_SIMULATION_VERSION } from './combat.version'
import { compileSpawnSpecBundles } from './combat.spawn-spec-compiler'
import { mapBattleTicksToCombatTicks, mapSimUnitToReplay } from './combat.replay-mapper'
import type { BattleAction, BattleTick } from './combat.actions'
import type { CombatCatalog } from './combat.catalog.types'
import type { UnitTypeConfig } from './combat.types'
import { mapDefinitionToUnitTypeConfig } from './combat.definition-mapper'

export function executeCombatSimulation(input: BattleInput): CombatRunResult {
  const seed = input.seed
  const rng = new PRNG(seed)
  const dt = 0.1
  const arena = input.arena
  const rules = input.rules
  const maxTicks = rules.maxTicks
  const timeoutPolicy = rules.timeoutPolicy === 'defender_win' ? 'defender_holds' : 'draw'
  const defenseResolutionMode = rules.defenseResolutionMode

  const runtime = createEcsCombatRuntime({ profile: false, defenseResolutionMode })
  const unitTypes: Record<string, UnitTypeConfig> = {}
  for (const [key, def] of Object.entries(input.definitions)) {
    unitTypes[key] = mapDefinitionToUnitTypeConfig(def)
  }
  const catalog: CombatCatalog = { unitTypes }

  const obstacles = arena.obstacles
  const flowFieldMap = createPathfindingMap(obstacles)

  runtime.world.resources.set('catalog', catalog)

  for (const spawnSpec of input.units) {
    const bundles = compileSpawnSpecBundles(spawnSpec, input.definitions, catalog, rng, arena.width, arena.height)
    runtime.world.queueCompiledUnitCreation(...bundles)
  }
  runtime.world.flushStructuralCommands()

  const initialStateSim = runtime.snapshotUnits()
  const initialState = initialStateSim.map(u => mapSimUnitToReplay(u))

  const resources = runtime.world.resources
  resources.set('clock', { tick: 0, dt, maxTicks, timeoutPolicy })
  resources.set('rng', rng)
  resources.set('actions', [])
  resources.set('obstacles', obstacles)
  resources.set('flowField', flowFieldMap)
  resources.set('globals', [])

  const logs: BattleTick[] = []
  let tick = 0, resolvedOutcome: BattleOutcome | null = null

  while (tick < maxTicks) {
    const actions: BattleAction[] = []
    runtime.world.resources.require('clock').tick = tick
    runtime.world.resources.set('actions', actions)
    runtime.runStage('pre_action', { tick, actions, rng, activeGlobals: [] })

    const terminalOutcome = runtime.getTerminalOutcome()
    if (terminalOutcome) { resolvedOutcome = terminalOutcome; break }

    runtime.runStage('action', { tick, actions, rng, activeGlobals: [] })
    runtime.runStage('post_action', { tick, actions, rng, activeGlobals: [] })

    if (actions.length > 0) logs.push({ tick, actions })
    tick++
  }

  const outcome = resolvedOutcome ?? getTimeoutOutcome(timeoutPolicy)
  const survivors = runtime.getSurvivors().map(u => mapSimUnitToReplay(u))

  return {
    winner: outcome.winner,
    seed,
    elapsedTicks: tick,
    terminationReason: outcome.reason,
    initialState,
    survivors,
    logs: mapBattleTicksToCombatTicks(logs),
    engineVersion: defenseResolutionMode === 'v8_sequential' ? V8_SIMULATION_VERSION : V9_SIMULATION_VERSION,
    engineRevision: defenseResolutionMode === 'v8_sequential' ? V8_SIMULATION_REVISION : V9_SIMULATION_REVISION,
  }
}
