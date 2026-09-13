import type { BattleInput, CombatRunResult } from './contracts/index.js'
import { PRNG } from './math/index.js'
import { createEcsCombatRuntime } from './ecs/combat-ecs-runtime.js'
import { createPathfindingMap } from './combat.pathfinding.js'
import { getTimeoutOutcome, type BattleOutcome } from './combat.outcome.js'
import { V8_SIMULATION_REVISION, V8_SIMULATION_VERSION, V9_SIMULATION_REVISION, V9_SIMULATION_VERSION } from './combat.version.js'
import { compileSpawnSpecBundles } from './combat.spawn-spec-compiler.js'
import { mapBattleTicksToCombatTicks, mapSimUnitToReplay } from './combat.replay-mapper.js'
import type { BattleAction, BattleTick } from './combat.actions.js'
import type { CombatCatalog } from './combat.catalog.types.js'
import type { UnitTypeConfig } from './combat.types.js'
import { mapDefinitionToUnitTypeConfig } from './combat.definition-mapper.js'
import type { ActiveGlobalEffect } from './combat.primitives.js'
import { createCombatMetrics, finalizeCombatMetrics, recordCombatActions, recordCombatTick } from './combat.metrics.js'
export function executeCombatSimulation(input: BattleInput): CombatRunResult {
  const seed = input.seed
  const rng = new PRNG(seed)
  const dt = 0.1
  const arena = input.arena
  const rules = input.rules
  const maxTicks = rules.maxTicks
  const timeoutPolicy = rules.timeoutPolicy === 'defender_win' ? 'defender_holds' : 'draw'
  const defenseResolutionMode = rules.defenseResolutionMode

  const runtime = createEcsCombatRuntime({ profile: rules.profile === true, defenseResolutionMode })
  const passedCatalog = input.catalog as unknown as CombatCatalog | undefined
  const unitTypes: Record<string, UnitTypeConfig> = { ...(passedCatalog?.unitTypes ?? {}) }
  for (const [key, def] of Object.entries(input.definitions)) {
    if (!unitTypes[key]) {
      unitTypes[key] = mapDefinitionToUnitTypeConfig(def)
    }
  }
  const activeGlobals: ActiveGlobalEffect[] = (input.scheduledEffects ?? []).map(effect => ({
    team: effect.team,
    effect: { id: effect.id, type: effect.type as import('./combat.primitives.js').ScheduledGlobalEffectKind, value: effect.value },
  }))
  const catalog: CombatCatalog = {
    unitTypes,
    upgrades: passedCatalog?.upgrades ?? {},
    targetingProfiles: passedCatalog?.targetingProfiles,
  }

  const obstacles = arena.obstacles
  const flowFieldMap = createPathfindingMap(obstacles, arena)

  runtime.world.resources.set('catalog', catalog)
  runtime.world.resources.set('arena', arena)

  for (const spawnSpec of input.units) {
    const bundles = compileSpawnSpecBundles(spawnSpec, input.definitions, catalog, rng, arena.width, arena.height)
    runtime.world.queueCompiledUnitCreation(...bundles)
  }
  runtime.world.flushStructuralCommands()

  const initialStateSim = runtime.snapshotUnits()
  const initialState = initialStateSim.map(u => mapSimUnitToReplay(u))
  const metrics = rules.trackMetrics ? createCombatMetrics(runtime.world) : undefined

  const resources = runtime.world.resources
  resources.set('clock', { tick: 0, dt, maxTicks, timeoutPolicy })
  resources.set('rng', rng)
  resources.set('actions', [])
  resources.set('obstacles', obstacles)
  resources.set('arena', arena)
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
    runtime.runStage('post_action', { tick, actions, rng, activeGlobals })
    if (metrics) {
      recordCombatActions(metrics, tick, actions, runtime.world)
      recordCombatTick(metrics, runtime.world)
    }

    if (actions.length > 0) logs.push({ tick, actions })
    tick++
  }

  const outcome = resolvedOutcome ?? getTimeoutOutcome(timeoutPolicy)
  const survivorsSim = runtime.getSurvivors()
  const survivors = survivorsSim.map(u => mapSimUnitToReplay(u))
  const spatialProfile = rules.profile
    ? runtime.world.resources.require('entitySpatial').getProfile(runtime.world)
    : undefined

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
    profile: {
      __marsCompat: {
        simInitialState: initialStateSim,
        simSurvivors: survivorsSim,
        simLogs: logs,
        metrics: metrics ? finalizeCombatMetrics(metrics, tick) : undefined,
        spatialProfile,
      },
    },
  }
}
