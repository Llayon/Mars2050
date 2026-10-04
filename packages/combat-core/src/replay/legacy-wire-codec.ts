import {
  type CombatEvent,
  type CombatReplayUnit,
  type CombatRunResult,
  type CombatSnapshotUnit,
  type CombatTick,
  combatReplayUnitSchema,
  combatRunResultSchema,
  combatSnapshotUnitSchema,
} from '../contracts/index.js'
import type { BattleAction, BattleTick } from '../combat.actions.js'

export const CANONICAL_SNAPSHOT_KEYS = [
  'id', 'team', 'type', 'rank', 'squadId', 'summonSourceId',
  'x', 'y', 'velocity', 'currentAngle', 'initialAngle', 'offsetX', 'offsetY', 'size', 'isFlying',
  'hp', 'maxHp', 'shield', 'maxShield', 'isDead', 'resurrectOnce', 'isTemporary', 'temporaryDuration', 'reassemblyConfig', 'reassemblyState', 'reassemblyTriggersUsed',
  'attack', 'defense', 'speed', 'range', 'actionCooldownMax', 'actionCooldown', 'canTargetAir', 'multishot', 'antiAirDamageMult', 'executeThreshold', 'lifestealMult', 'groundDamageMult', 'shieldDamageMult', 'armorPierceRatio', 'summonCounterDamageMult', 'accuracyPenaltyResist', 'rankScaling',
  'attackType', 'delivery', 'abilityPrograms', 'aoeRadius', 'spawnType', 'spawnCap', 'selfDestructOnAttack', 'statusOnHit', 'markOnHit', 'linePierce', 'coneAttack', 'beamAttack', 'barrageAttack', 'chainAttack', 'splitFire', 'sideWeapon', 'conditionalAttackMode', 'sweepAttack', 'emergeStrikePending', 'appliesEmp', 'leavesPuddle', 'smokeOnAction', 'pullOnHit', 'knockbackOnHit',
  'rampMultiplier', 'chargeDistance', 'aggroLockTicks', 'designatedSquadId', 'meleeSlotIndex', 'targetPriorityProfile', 'conditionalRange', 'controlBeam', 'controlProgress',
  'turnSpeed', 'isMoving', 'isNavigatingObstacle', 'lastProgressX', 'lastProgressY', 'lastTargetDistance', 'stuckTicks', 'avoidanceSide', 'avoidanceTicks', 'damageReductionWhileMoving', 'burrowConfig', 'isBurrowed', 'modeSwitchConfig', 'mobilityMode', 'stanceConfig', 'stanceMode', 'stanceTicks', 'stealthWhileMoving', 'movementStealthActive',
  'statusEffects', 'targetMark', 'stealthUntilAttack', 'hasAttacked', 'transformMode', 'transformState',
  'flatDamageBlock', 'shieldHitBlock', 'shieldHitBlockCharges', 'reactiveArmorCharges', 'reactiveArmorBlock', 'damageShareRadius', 'damageShareRatio', 'damageShareMaxTargets', 'projectileInterceptRadius', 'projectileInterceptCooldownMax', 'projectileInterceptCooldown', 'projectileInterceptMaxDamage',
  'supportAuras', 'supportPrograms', 'periodicAbilities', 'periodicPrograms', 'periodicProgramState', 'fieldEffect', 'formationModifiers',
  'triggerEffects', 'statGrowth', 'attackCharge', 'spawnerConfig', 'replicateOnKill', 'onDeathPuddle',
  'attackTargetId', 'rampTargetId', 'meleeSlotTargetId', 'meleeWaitingTargetId', 'lastProgressTargetId', 'summonOwnerId',
  'direction', 'squadLeader', 'targetId',
] as const

export const CANONICAL_SNAPSHOT_KEY_SET = new Set<string>(CANONICAL_SNAPSHOT_KEYS)

export const CANONICAL_ACTION_KEYS = [
  'unitId', 'type', 'targetId', 'damage', 'isCritical', 'isShieldHit',
  'fromX', 'fromY', 'toX', 'toY', 'facingAngle', 'isWalking', 'motionKind',
  'spawnType', 'spawnTeam', 'spawnMaxHp', 'hazardId', 'radius', 'statusType',
  'sourceUnitId', 'damageKind', 'cause', 'controlMode', 'stanceMode', 'modeState',
  'value', 'markEvent', 'markSquadId', 'markDuration', 'sourceUnitType', 'sourceTeam',
  'retargetCount', 'bonusDamage', 'impactId', 'launchTick', 'earliestLaunchTick',
  'impactTick', 'projectileKind', 'cancelReason',
  'sourceId', 'x', 'y', 'amount', 'details',
] as const

export const CANONICAL_ACTION_KEY_SET = new Set<string>(CANONICAL_ACTION_KEYS)

const BATTLE_ACTION_ALLOWED_KEYS = new Set<string>([
  'unitId', 'type', 'targetId', 'damage', 'isCritical', 'isShieldHit',
  'fromX', 'fromY', 'toX', 'toY', 'facingAngle', 'isWalking', 'motionKind',
  'spawnType', 'spawnTeam', 'spawnMaxHp', 'hazardId', 'radius', 'statusType',
  'sourceUnitId', 'damageKind', 'cause', 'controlMode', 'stanceMode', 'modeState',
  'value', 'markEvent', 'markSquadId', 'markDuration', 'sourceUnitType', 'sourceTeam',
  'retargetCount', 'bonusDamage', 'impactId', 'launchTick', 'earliestLaunchTick',
  'impactTick', 'projectileKind', 'cancelReason',
])

/**
 * Serializes an internal unit snapshot into a clean CombatSnapshotUnit DTO,
 * copying only allowlisted fields in their canonical component order.
 */
export function serializeCombatUnitSnapshot(unit: unknown): CombatSnapshotUnit {
  const raw = unit as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(raw)) {
    if (CANONICAL_SNAPSHOT_KEY_SET.has(key) && raw[key] !== undefined) {
      result[key] = raw[key]
    }
  }
  return result as CombatSnapshotUnit
}

/**
 * Validates and decodes raw JSON or DTO data into a typed CombatSnapshotUnit.
 */
export function deserializeCombatUnitSnapshot(input: unknown): CombatSnapshotUnit {
  combatSnapshotUnitSchema.parse(input)
  return serializeCombatUnitSnapshot(input)
}


/**
 * Serializes a BattleAction into a clean CombatEvent contract.
 */
export function serializeCombatEvent(action: unknown): CombatEvent {
  const act = action as Record<string, unknown>
  const event: Record<string, unknown> = {}
  for (const k of Object.keys(act)) {
    if (CANONICAL_ACTION_KEY_SET.has(k) && act[k] !== undefined) {
      event[k] = act[k]
    }
  }
  if (event.sourceId === undefined && typeof (act.sourceUnitId ?? act.unitId) === 'string') {
    event.sourceId = (act.sourceUnitId ?? act.unitId) as string
  }
  if (event.x === undefined && (act.toX !== undefined || act.fromX !== undefined)) {
    event.x = act.toX ?? act.fromX
  }
  if (event.y === undefined && (act.toY !== undefined || act.fromY !== undefined)) {
    event.y = act.toY ?? act.fromY
  }
  if (event.amount === undefined && (act.damage !== undefined || act.value !== undefined)) {
    event.amount = act.damage ?? act.value
  }
  return event as CombatEvent
}

/**
 * Deserializes a CombatEvent DTO back to a typed BattleAction.
 */
export function deserializeCombatAction(event: unknown): BattleAction {
  const raw = event as Record<string, unknown>
  const action: Record<string, unknown> = {}
  for (const k of Object.keys(raw)) {
    if (BATTLE_ACTION_ALLOWED_KEYS.has(k) && raw[k] !== undefined) {
      action[k] = raw[k]
    }
  }
  if (action.unitId === undefined && typeof raw.sourceId === 'string') {
    action.unitId = raw.sourceId
  }
  return action as unknown as BattleAction
}

/**
 * Serializes a BattleTick into a CombatTick contract.
 */
export function serializeCombatTick(tick: { tick: number; actions: readonly BattleAction[] }): CombatTick {
  return {
    tick: tick.tick,
    actions: tick.actions.map(serializeCombatEvent),
  }
}

/**
 * Deserializes a CombatTick DTO into a BattleTick.
 */
export function deserializeCombatTick(tick: CombatTick): BattleTick {
  return {
    tick: tick.tick,
    actions: tick.actions.map(deserializeCombatAction),
  }
}

/**
 * Normalizes a unit snapshot to match the legacy Mars replay JSON field format.
 */
export function serializeLegacyUnit(unit: CombatReplayUnit): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: unit.id,
    type: unit.type,
    team: unit.team,
    hp: unit.hp,
    maxHp: unit.maxHp,
    x: unit.x,
    y: unit.y,
    attack: unit.attack,
    range: unit.range,
    speed: unit.speed,
  }
  if (unit.squadId !== undefined) result.squadId = unit.squadId
  if (unit.squadLeader !== undefined) result.squadLeader = unit.squadLeader
  if (unit.isTemporary !== undefined) result.isTemporary = unit.isTemporary
  if (unit.summonOwnerId !== undefined) result.summonOwnerId = unit.summonOwnerId
  if (unit.summonSourceId !== undefined) result.summonSourceId = unit.summonSourceId
  if (unit.shield !== undefined) result.shield = unit.shield
  if (unit.maxShield !== undefined) result.maxShield = unit.maxShield
  if (unit.direction !== undefined) result.direction = unit.direction
  if (unit.targetId !== undefined) result.targetId = unit.targetId
  return result
}

/**
 * Validates and decodes raw JSON into a typed CombatReplayUnit.
 */
export function deserializeLegacyUnit(input: unknown): CombatReplayUnit {
  return combatReplayUnitSchema.parse(input)
}

/**
 * Encodes a complete CombatRunResult into a deterministic JSON string.
 */
export function encodeLegacyReplayJson(result: CombatRunResult): string {
  return JSON.stringify(result)
}

/**
 * Decodes and validates a complete JSON replay string into a typed CombatRunResult.
 */
export function decodeLegacyReplayJson(json: string): CombatRunResult {
  const parsed = JSON.parse(json) as unknown
  return combatRunResultSchema.parse(parsed)
}

