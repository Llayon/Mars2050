import { MAX_TICKS } from './combat.config'
import { GLOBAL_UPGRADES, type GlobalUpgradeConfig } from './combat.upgrades'
import { processSpawnerLogic } from './combat.spawner'
import { processPostHazardPrimitives, processPreActionPrimitives } from './combat.tick-primitives'
import type { UnitRow, BattleAction, BattleTick, BattleResult } from './combat.types'
import type { Team, SimUnit, Obstacle, SimHazard } from './combat.sim.types'
import { actionSystem } from './combat.systems'
import { targetingSystem } from './combat.targeting'
import { movementSystem } from './combat.movement'
import { createMeleeEngagementState, reserveMeleeEngagementSlot } from './combat.melee-engagement'
import { createCombatMetrics, finalizeCombatMetrics, recordCombatActions, recordCombatTick, type BattleSimulationOptions } from './combat.metrics'
import { applyDepenetration } from './combat.depenetration'
import { hasPendingReassembly } from './combat.reassembly'
import { PRNG, generateObstacles } from './combat.utils'
import { createPathfindingMap } from './combat.pathfinding'
import { SpatialHash } from './spatial-hash'
import { canAttackControlledTarget } from './combat.control'
import { getTimeoutOutcome, type BattleOutcome } from './combat.outcome'
import { CURRENT_SIMULATION_VERSION } from './combat.version'
import { resolveUnitDeath, type DeathCause } from './combat.death'
import { createRuntimeSquad } from './combat.squad-factory'
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
  attackerUnits.forEach(row => units.push(...createRuntimeSquad(row, 'attacker', rng)))
  defenderUnits.forEach(row => units.push(...createRuntimeSquad(row, 'defender', rng)))

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
    for (let index = unitCountBeforePrimitives; index < units.length; index++) {
      if (!units[index].isDead) spatialHash.insert(units[index])
    }
    const resolveEnvironmentalDeath = (dead: SimUnit, sourceUnitId: string | undefined, cause: DeathCause) => {
      const source = sourceUnitId ? units.find(unit => unit.id === sourceUnitId) : undefined
      resolveUnitDeath(dead, source, cause, { units, hazards, actions, rng })
    }
    runtime.runStatusPhase(actions, resolveEnvironmentalDeath)

    const pendingAttackers = units.some(u => u.team === 'attacker' && hasPendingReassembly(u))
    const pendingDefenders = units.some(u => u.team === 'defender' && hasPendingReassembly(u))
    const terminalOutcome = runtime.getTerminalOutcome(hazards, pendingAttackers, pendingDefenders)
    if (terminalOutcome) { resolvedOutcome = terminalOutcome; break }

    const turnOrder = runtime.getTurnOrder()
    const meleeEngagement = createMeleeEngagementState();

    for (const unit of turnOrder) {
      if (unit.isDead) continue;
      runtime.tickModifiers(unit, dt, actions, expired => resolveEnvironmentalDeath(expired, undefined, 'expiration')); if (unit.isDead) continue;

      const target = targetingSystem(unit, units, meleeEngagement, spatialHash);
      if (!target) continue;

      const unitCountBeforeActions = units.length;
      processSpawnerLogic(unit, target, units, hazards, actions, rng);

      const canActOnTarget = target.team !== unit.team || unit.attackType === 'heal' || canAttackControlledTarget(unit, target);
      const hasEngagement = canActOnTarget ? reserveMeleeEngagementSlot(unit, target, meleeEngagement) : true;

      const acted = canActOnTarget && hasEngagement && actionSystem(unit, target, units, hazards, actions, rng, tick, spatialHash);

      for (let i = unitCountBeforeActions; i < units.length; i++) {
        if (!units[i].isDead) spatialHash.insert(units[i]);
      }
      if (!acted) {
        movementSystem(unit, target, units, actions, dt, rng, flowFieldMap, obstacles, spatialHash);
        spatialHash.update(unit);
      }
    }

    runtime.runHazardPhase(actions, resolveEnvironmentalDeath, spatialHash);
    processPostHazardPrimitives(units, triggerContext);
    applyDepenetration(units, actions);
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
    profile: options.profile ? spatialHash.getProfile() : undefined,
  }
}

function normalizeMaxTicks(value?: number): number {
  if (value === undefined || !Number.isFinite(value)) return MAX_TICKS
  return Math.max(1, Math.min(2000, Math.floor(value)))
}
