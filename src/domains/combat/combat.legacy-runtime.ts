import type { BattleAction } from './combat.actions'
import { getTerminalBattleOutcome } from './combat.outcome'
import type { SimHazard, SimUnit } from './combat.sim.types'
import { tickStatuses } from './combat.status'
import type { CombatRuntime } from './combat.runtime'
import { getCombatTurnOrder } from './combat.turn-order'
import { tickModifiersSystem } from './combat.systems'
import { processHazards } from './combat.hazards'
import { createRuntimeSquad } from './combat.squad-factory'
import { createMeleeEngagementState, reserveMeleeEngagementSlot } from './combat.melee-engagement'
import { targetingSystem } from './combat.targeting'
import { SpatialHash } from './spatial-hash'
import { applyDepenetration } from './combat.depenetration'
import { movementSystem } from './combat.movement'
import { actionSystem } from './combat.systems'
import { processPostHazardPrimitives } from './combat.tick-primitives'
import { resolveUnitDeath, type DeathCause } from './combat.death'
import { processSpawnerLogic } from './combat.spawner'
import { hasPendingReassembly, processReassemblies } from './combat.reassembly'
import { processBurrowRegeneration } from './combat.burrow'
import { processGrowthAndCharge } from './combat.growth-charge'
import { processTransformModes } from './combat.transform'
import type { PRNG } from './combat.utils'

export function createLegacyCombatRuntime(): CombatRuntime {
  const units: SimUnit[] = []
  const hazards: SimHazard[] = []
  let meleeEngagement = createMeleeEngagementState()
  let targetingSpatialHash: SpatialHash | undefined
  return {
    units,
    hazards,
    addSquad: (row, team, rng) => { units.push(...createRuntimeSquad(row, team, rng)) },
    flushStructuralCommands: () => undefined,
    beginTargetingPhase: spatial => { meleeEngagement = createMeleeEngagementState(); targetingSpatialHash = spatial },
    selectTarget: unit => targetingSystem(unit, units, meleeEngagement, targetingSpatialHash),
    reserveMeleeSlot: (unit, target) => reserveMeleeEngagementSlot(unit, target, meleeEngagement),
    processSpawner: (unit, target, actions, context) => {
      processSpawnerLogic(unit, target, units, hazards, actions, context.rng)
    },
    actUnit: (unit, target, actions, context) => ({
      acted: actionSystem(unit, target, units, hazards, actions, context.rng, context.tick, context.spatialHash),
      actorSynchronized: false,
    }),
    moveUnit: (unit, target, actions, context) => {
      movementSystem(unit, target, units, actions, context.dt, context.rng, context.flowField, context.obstacles, context.spatialHash)
      context.spatialHash.update(unit)
    },
    completeActorTurn: () => undefined,
    insertSpatialUnit: () => undefined,
    snapshotUnits: () => JSON.parse(JSON.stringify(units)) as SimUnit[],
    getSurvivors: () => units.filter(unit => !unit.isDead && !unit.isTemporary),
    getTurnOrder: () => getCombatTurnOrder(units),
    tickModifiers: (unit, dt, actions, rng) => tickModifiersSystem(
      unit,
      dt,
      actions,
      expired => resolveEnvironmentalDeath(expired, undefined, 'expiration', actions, rng),
    ),
    runReassemblyPhase: actions => processReassemblies(units, actions),
    runGrowthAndChargePhase: (tick, actions) =>
      processGrowthAndCharge(tick, units, actions),
    runBurrowRegenerationPhase: actions => processBurrowRegeneration(units, actions),
    runTransformModePhase: (tick, actions) => processTransformModes(tick, units, actions),
    runStatusPhase(actions: BattleAction[], rng: PRNG): void {
      for (const unit of units) {
        if (!unit.isDead) {
          tickStatuses(unit, actions, {
            onUnitDeath: (dead, sourceUnitId, cause) =>
              resolveEnvironmentalDeath(dead, sourceUnitId, cause, actions, rng),
          })
        }
      }
    },
    runHazardPhase(actions, spatialHash, rng): void {
      processHazards(
        hazards,
        units,
        actions,
        (dead, sourceUnitId, cause) =>
          resolveEnvironmentalDeath(dead, sourceUnitId, cause, actions, rng),
        spatialHash,
      )
    },
    runPostHazardPhase: triggerContext => processPostHazardPrimitives(units, triggerContext),
    runDepenetration: actions => applyDepenetration(units, actions),
    getTerminalOutcome(hazards: SimHazard[]) {
      const pendingAttackers = units.some(unit =>
        unit.team === 'attacker' && hasPendingReassembly(unit),
      )
      const pendingDefenders = units.some(unit =>
        unit.team === 'defender' && hasPendingReassembly(unit),
      )
      return getTerminalBattleOutcome(units, hazards, pendingAttackers, pendingDefenders)
    },
  }

  function resolveEnvironmentalDeath(
    dead: SimUnit,
    sourceUnitId: string | undefined,
    cause: DeathCause,
    actions: BattleAction[],
    rng: PRNG,
  ): void {
    const source = sourceUnitId
      ? units.find(unit => unit.id === sourceUnitId)
      : undefined
    resolveUnitDeath(dead, source, cause, { units, hazards, actions, rng })
  }
}
