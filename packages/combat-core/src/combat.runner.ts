import type { BattleInput, CombatRunResult } from './contracts/index.js'
import {
  ENGINE_ID,
  ENGINE_VERSION,
  ENGINE_BUILD_ID,
  PUBLIC_CONTRACT_VERSION,
  REPLAY_SCHEMA_ID,
  REPLAY_SCHEMA_VERSION,
  type CombatMetadata,
  computeRulesetIdentity,
} from './contracts/index.js'
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
import type { ActiveGlobalEffect, ScheduledGlobalEffectKind } from './combat.primitives.js'
import { CombatDefinitionError } from './combat.definition-error.js'
import { createCombatMetrics, finalizeCombatMetrics, recordCombatActions, recordCombatTick } from './combat.metrics.js'
import { validateBattleInput } from './combat.input-validator.js'
import { isNormalizedBattleInput } from './combat.input-brand.js'

const SUPPORTED_SCHEDULED_EFFECT_KINDS: readonly string[] = ['orbital_strike', 'mass_heal', 'mass_shield', 'global_emp']

/**
 * Guards the scheduled-effect boundary: only engine-supported kinds pass.
 * @param type Raw effect type from BattleInput.
 * @returns True when the engine can execute the kind.
 */
function isSupportedScheduledEffectKind(type: string): type is ScheduledGlobalEffectKind {
  return SUPPORTED_SCHEDULED_EFFECT_KINDS.includes(type)
}
export function executeCombatSimulation(input: BattleInput): CombatRunResult {
  const validatedInput = isNormalizedBattleInput(input) ? input : validateBattleInput(input)
  const seed = validatedInput.seed
  const rng = new PRNG(seed)
  const dt = 0.1
  const arena = validatedInput.arena
  const rules = validatedInput.rules
  const maxTicks = rules.maxTicks
  const timeoutPolicy = rules.timeoutPolicy === 'attacker_win'
    ? 'attacker_holds'
    : rules.timeoutPolicy === 'defender_win'
      ? 'defender_holds'
      : 'draw'
  const defenseResolutionMode = rules.defenseResolutionMode

  // Validate scheduled effects before creating the world: unknown kinds are
  // rejected, and the caller-supplied tick travels with the effect.
  const activeGlobals: ActiveGlobalEffect[] = (validatedInput.scheduledEffects ?? []).map(effect => {
    if (!isSupportedScheduledEffectKind(effect.type)) {
      throw new CombatDefinitionError('UNSUPPORTED_SCHEDULED_EFFECT', '', '', { effectId: effect.id, effectType: effect.type })
    }
    return {
      team: effect.team,
      effect: { id: effect.id, type: effect.type, value: effect.value, tick: effect.tick },
    }
  })

  const passedCatalog = validatedInput.catalog as unknown as CombatCatalog | undefined
  const unitTypes: Record<string, UnitTypeConfig> = {}
  for (const [key, def] of Object.entries(validatedInput.definitions)) {
    unitTypes[key] = mapDefinitionToUnitTypeConfig(def)
  }
  if (passedCatalog?.unitTypes) {
    for (const [key, cfg] of Object.entries(passedCatalog.unitTypes)) {
      unitTypes[key] = cfg
    }
  }
  const catalog: CombatCatalog = {
    unitTypes,
    upgrades: passedCatalog?.upgrades ?? {},
    targetingProfiles: passedCatalog?.targetingProfiles,
  }

  const runtime = createEcsCombatRuntime({
    profile: rules.profile === true,
    defenseResolutionMode,
    catalog,
  })

  const obstacles = arena.obstacles
  const flowFieldMap = createPathfindingMap(obstacles, arena)

  runtime.world.resources.set('arena', arena)


  for (const spawnSpec of validatedInput.units) {
    const bundles = compileSpawnSpecBundles(spawnSpec, validatedInput.definitions, catalog, rng, arena)
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
    if (terminalOutcome) {
      resolvedOutcome = terminalOutcome
      // The terminal pre-action phase has already committed its mutations.
      // Keep its events and count that observable tick, without running later phases.
      if (actions.length > 0) {
        if (metrics) {
          recordCombatActions(metrics, tick, actions, runtime.world)
          recordCombatTick(metrics, runtime.world)
        }
        logs.push({ tick, actions })
        tick++
      }
      break
    }

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

  const metricsData = metrics ? finalizeCombatMetrics(metrics, tick) : undefined
  const profile = rules.profile && spatialProfile ? { spatial: spatialProfile } : undefined

  const metadata: CombatMetadata = {
    contractVersion: PUBLIC_CONTRACT_VERSION,
    engine: {
      id: ENGINE_ID,
      version: ENGINE_VERSION,
      revision: defenseResolutionMode === 'v8_sequential' ? V8_SIMULATION_REVISION : V9_SIMULATION_REVISION,
      buildId: ENGINE_BUILD_ID,
      defenseResolutionMode,
    },
    ruleset: computeRulesetIdentity(input),
    replaySchema: {
      id: REPLAY_SCHEMA_ID,
      version: REPLAY_SCHEMA_VERSION,
    },
  }

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
    metadata,
    ...(profile ? { profile } : {}),
    ...(metricsData ? { metrics: metricsData } : {}),
  } as CombatRunResult
}
