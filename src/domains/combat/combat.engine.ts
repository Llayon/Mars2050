import { MAX_TICKS } from './combat.config'
import { GLOBAL_UPGRADES, type GlobalUpgradeConfig } from './combat.upgrades'
import { processSpawnerLogic } from './combat.spawner'
import { processPreActionPrimitives } from './combat.tick-primitives'
import type { UnitRow, BattleAction, BattleTick, BattleResult } from './combat.types'
import type { Team, SimUnit, Obstacle, SimHazard } from './combat.sim.types'
import { createCombatMetrics, finalizeCombatMetrics, recordCombatActions, recordCombatTick, type BattleSimulationOptions } from './combat.metrics'
import { hasPendingReassembly } from './combat.reassembly'
import { PRNG, generateObstacles } from './combat.utils'
import { createPathfindingMap } from './combat.pathfinding'
import { SpatialHash } from './spatial-hash'
import type { SpatialQueryProfile } from './spatial-hash'
import { canAttackControlledTarget } from './combat.control'
import { getTimeoutOutcome, type BattleOutcome } from './combat.outcome'
import { CURRENT_SIMULATION_VERSION } from './combat.version'
import { createLegacyCombatRuntime } from './combat.legacy-runtime'
import { createEcsCombatRuntime } from './ecs/combat-ecs-runtime'
export function simulateBattle(attackerUnits: UnitRow[], defenderUnits: UnitRow[], providedSeed?: number, providedObstacles?: Obstacle[], attackerGlobals: string[] = [], defenderGlobals: string[] = [], options: BattleSimulationOptions = {}): BattleResult {
  const seed = providedSeed ?? Date.now(), rng = new PRNG(seed), dt = 0.1
  const maxTicks = normalizeMaxTicks(options.maxTicks)
  const timeoutPolicy = options.timeoutPolicy ?? 'draw'
  const ecsRuntime = options.engine === 'legacy' ? undefined : createEcsCombatRuntime()
  const runtime = ecsRuntime ?? createLegacyCombatRuntime()
  const units: SimUnit[] = runtime.units, hazards: SimHazard[] = runtime.hazards, activeGlobals: { team: Team, upg: GlobalUpgradeConfig }[] = []
  attackerGlobals.forEach(id => { if (GLOBAL_UPGRADES[id]) activeGlobals.push({ team: 'attacker', upg: GLOBAL_UPGRADES[id] }) })
  defenderGlobals.forEach(id => { if (GLOBAL_UPGRADES[id]) activeGlobals.push({ team: 'defender', upg: GLOBAL_UPGRADES[id] }) })
  const obstacles: Obstacle[] = providedObstacles || generateObstacles(seed);
  const flowFieldMap = createPathfindingMap(obstacles), spatialHash = new SpatialHash();
  const movementContext = { dt, rng, flowField: flowFieldMap, obstacles, spatialHash }
  attackerUnits.forEach(row => runtime.addSquad(row, 'attacker', rng))
  defenderUnits.forEach(row => runtime.addSquad(row, 'defender', rng))

  const initialState = runtime.snapshotUnits()
  const metrics = options.trackMetrics ? createCombatMetrics(units) : undefined

  if (ecsRuntime) {
    const resources = ecsRuntime.world.resources
    resources.set('clock', { tick: 0, dt, maxTicks, timeoutPolicy })
    resources.set('rng', rng)
    resources.set('actions', [])
    resources.set('obstacles', obstacles)
    resources.set('flowField', flowFieldMap)
    resources.set('spatial', spatialHash)
    resources.set('globals', activeGlobals)
    resources.set('metrics', metrics)
  }

  const logs: BattleTick[] = []
  let tick = 0, resolvedOutcome: BattleOutcome | null = null

  while (tick < maxTicks) {
    const actions: BattleAction[] = []
    if (ecsRuntime) {
      ecsRuntime.world.resources.require('clock').tick = tick
      ecsRuntime.world.resources.set('actions', actions)
    }
    spatialHash.clear();
    for (const unit of units) {
      if (!unit.isDead) spatialHash.insert(unit);
    }
    const unitCountBeforePrimitives = units.length
    const triggerContext = processPreActionPrimitives(tick, activeGlobals, units, hazards, actions, rng, spatialHash);
    runtime.flushStructuralCommands()
    for (let index = unitCountBeforePrimitives; index < units.length; index++) {
      if (!units[index].isDead) spatialHash.insert(units[index])
    }
    runtime.runStatusPhase(actions, rng)

    const pendingAttackers = units.some(u => u.team === 'attacker' && hasPendingReassembly(u))
    const pendingDefenders = units.some(u => u.team === 'defender' && hasPendingReassembly(u))
    const terminalOutcome = runtime.getTerminalOutcome(hazards, pendingAttackers, pendingDefenders)
    if (terminalOutcome) { resolvedOutcome = terminalOutcome; break }

    const turnOrder = runtime.getTurnOrder()
    runtime.beginTargetingPhase(spatialHash)

    for (const unit of turnOrder) {
      if (unit.isDead) continue;
      runtime.tickModifiers(unit, dt, actions, rng); if (unit.isDead) continue;

      const target = runtime.selectTarget(unit);
      if (!target) continue;

      const unitCountBeforeActions = units.length;
      const actionStart = actions.length;
      processSpawnerLogic(unit, target, units, hazards, actions, rng);

      const canActOnTarget = target.team !== unit.team || unit.attackType === 'heal' || canAttackControlledTarget(unit, target);
      const hasEngagement = canActOnTarget ? runtime.reserveMeleeSlot(unit, target) : true;

      const actionResult = canActOnTarget && hasEngagement
        ? runtime.actUnit(unit, target, actions, { rng, tick, spatialHash })
        : { acted: false, actorSynchronized: false }
      const acted = actionResult.acted

      runtime.flushStructuralCommands()

      for (let i = unitCountBeforeActions; i < units.length; i++) {
        if (!units[i].isDead) { spatialHash.insert(units[i]); runtime.insertSpatialUnit(units[i]) }
      }
      if (!acted) {
        runtime.moveUnit(unit, target, actions, movementContext);
      }
      runtime.completeActorTurn(unit, actions, actionStart, !acted || actionResult.actorSynchronized)
    }

    runtime.runHazardPhase(actions, spatialHash, rng);
    runtime.runPostHazardPhase(triggerContext);
    runtime.runDepenetration(actions);
    if (metrics) { recordCombatActions(metrics, tick, actions, units); recordCombatTick(metrics, units) }
    
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
    simulationVersion: CURRENT_SIMULATION_VERSION,
    profile: options.profile ? mergeSpatialProfiles(
      spatialHash.getProfile(),
      ecsRuntime?.world.resources.require('entitySpatial').getProfile(),
    ) : undefined,
  }
}

function mergeSpatialProfiles(primary: SpatialQueryProfile, secondary?: SpatialQueryProfile): SpatialQueryProfile {
  if (!secondary) return primary
  return {
    queryCount: primary.queryCount + secondary.queryCount,
    candidateCount: primary.candidateCount + secondary.candidateCount,
    maxCandidates: Math.max(primary.maxCandidates, secondary.maxCandidates),
  }
}

function normalizeMaxTicks(value?: number): number {
  if (value === undefined || !Number.isFinite(value)) return MAX_TICKS
  return Math.max(1, Math.min(2000, Math.floor(value)))
}
