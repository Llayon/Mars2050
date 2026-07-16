import type { BattleAction } from './combat.actions'
import { getTerminalBattleOutcome } from './combat.outcome'
import type { SimHazard, SimUnit } from './combat.sim.types'
import { tickStatuses } from './combat.status'
import type { CombatRuntime, RuntimeDeathHandler } from './combat.runtime'
import { getCombatTurnOrder } from './combat.turn-order'
import { tickModifiersSystem } from './combat.systems'
import { processHazards } from './combat.hazards'
import { createRuntimeSquad } from './combat.squad-factory'
import { createMeleeEngagementState, reserveMeleeEngagementSlot } from './combat.melee-engagement'
import { targetingSystem } from './combat.targeting'
import { SpatialHash } from './spatial-hash'
import { applyDepenetration } from './combat.depenetration'

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
    completeActorTurn: () => undefined,
    insertSpatialUnit: () => undefined,
    updateSpatialUnit: () => undefined,
    snapshotUnits: () => JSON.parse(JSON.stringify(units)) as SimUnit[],
    getSurvivors: () => units.filter(unit => !unit.isDead && !unit.isTemporary),
    getTurnOrder: () => getCombatTurnOrder(units),
    tickModifiers: (unit, dt, actions, onExpire) => tickModifiersSystem(unit, dt, actions, onExpire),
    runStatusPhase(actions: BattleAction[], onUnitDeath: RuntimeDeathHandler): void {
      for (const unit of units) {
        if (!unit.isDead) tickStatuses(unit, actions, { onUnitDeath })
      }
    },
    runHazardPhase(actions, onUnitDeath, spatialHash): void {
      processHazards(hazards, units, actions, onUnitDeath, spatialHash)
    },
    runDepenetration: actions => applyDepenetration(units, actions),
    getTerminalOutcome(hazards: SimHazard[], pendingAttackers: boolean, pendingDefenders: boolean) {
      return getTerminalBattleOutcome(units, hazards, pendingAttackers, pendingDefenders)
    },
  }
}
