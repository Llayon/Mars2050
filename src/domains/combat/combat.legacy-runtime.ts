import type { BattleAction } from './combat.actions'
import { getTerminalBattleOutcome } from './combat.outcome'
import type { SimHazard, SimUnit } from './combat.sim.types'
import { tickStatuses } from './combat.status'
import type { CombatRuntime, RuntimeDeathHandler } from './combat.runtime'
import { getCombatTurnOrder } from './combat.turn-order'
import { tickModifiersSystem } from './combat.systems'
import { processHazards } from './combat.hazards'
import { createRuntimeSquad } from './combat.squad-factory'

export function createLegacyCombatRuntime(): CombatRuntime {
  const units: SimUnit[] = []
  const hazards: SimHazard[] = []
  return {
    units,
    hazards,
    addSquad: (row, team, rng) => { units.push(...createRuntimeSquad(row, team, rng)) },
    flushStructuralCommands: () => undefined,
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
    getTerminalOutcome(hazards: SimHazard[], pendingAttackers: boolean, pendingDefenders: boolean) {
      return getTerminalBattleOutcome(units, hazards, pendingAttackers, pendingDefenders)
    },
  }
}
