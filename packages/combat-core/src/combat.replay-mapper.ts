import type { SimUnit, Team } from './combat.sim.types.js'
import type { BattleAction, BattleTick } from './combat.actions.js'
import type { CombatReplayUnit, CombatEvent, CombatTick } from './contracts/index.js'
import {
  serializeCombatEvent,
  serializeCombatTick,
  serializeCombatUnitSnapshot,
} from './replay/legacy-wire-codec.js'

/**
 * Maps an internal simulation unit snapshot to the clean CombatReplayUnit contract.
 */
export function mapSimUnitToReplay(unit: SimUnit, team?: Team): CombatReplayUnit {
  const snapshot = serializeCombatUnitSnapshot(unit)
  if (team) {
    snapshot.team = team
  }
  return snapshot
}

/**
 * Maps internal BattleAction to CombatEvent contract.
 */
export function mapBattleActionToCombatEvent(action: BattleAction): CombatEvent {
  return serializeCombatEvent(action)
}

/**
 * Maps internal BattleTick logs to CombatTick contract.
 */
export function mapBattleTicksToCombatTicks(logs: readonly BattleTick[]): CombatTick[] {
  return logs.map(serializeCombatTick)
}
