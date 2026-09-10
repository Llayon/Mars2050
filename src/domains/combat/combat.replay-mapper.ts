import type { SimUnit, Team } from './combat.sim.types'
import type { BattleAction, BattleTick } from './combat.actions'
import type { CombatReplayUnit, CombatEvent, CombatTick } from '@mars2050/combat-core/contracts'
import { getDir } from '@mars2050/combat-core/math'

/**
 * Maps an internal simulation unit snapshot to the clean CombatReplayUnit contract.
 */
export function mapSimUnitToReplay(unit: SimUnit, team?: Team): CombatReplayUnit {
  const dir = unit.velocity && (unit.velocity.x !== 0 || unit.velocity.y !== 0)
    ? getDir(unit.velocity.x, unit.velocity.y)
    : undefined
  return {
    id: unit.id,
    type: unit.type,
    team: (team ?? unit.team) as 'attacker' | 'defender',
    hp: Math.max(0, unit.hp),
    maxHp: unit.maxHp,
    x: unit.x,
    y: unit.y,
    attack: unit.attack,
    range: unit.range,
    speed: unit.speed,
    squadId: unit.squadId,
    squadLeader: undefined,
    isTemporary: unit.isTemporary,
    summonOwnerId: unit.summonOwnerId,
    summonSourceId: unit.summonSourceId,
    shield: unit.shield,
    maxShield: unit.maxShield,
    direction: dir,
    targetId: unit.attackTargetId ?? null,
  }
}

/**
 * Maps internal BattleAction to CombatEvent contract.
 */
export function mapBattleActionToCombatEvent(action: BattleAction): CombatEvent {
  return {
    ...action,
    type: action.type,
    sourceId: action.sourceUnitId ?? action.unitId,
    targetId: action.targetId,
    x: action.toX ?? action.fromX,
    y: action.toY ?? action.fromY,
    amount: action.damage ?? action.value,
  }
}

/**
 * Maps internal BattleTick logs to CombatTick contract.
 */
export function mapBattleTicksToCombatTicks(logs: BattleTick[]): CombatTick[] {
  return logs.map(log => ({
    tick: log.tick,
    actions: log.actions.map(mapBattleActionToCombatEvent),
  }))
}
