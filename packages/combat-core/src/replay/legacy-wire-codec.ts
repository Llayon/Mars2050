import {
  type CombatEvent,
  type CombatRunResult,
  type CombatSnapshotUnit,
  type CombatTick,
  CANONICAL_SNAPSHOT_KEYS,
  CANONICAL_SNAPSHOT_KEY_SET,
  CANONICAL_ACTION_KEYS,
  CANONICAL_ACTION_KEY_SET,
  CANONICAL_STATUS_EFFECT_KEY_SET,
  CANONICAL_TARGET_MARK_KEY_SET,
  combatEventSchema,
  combatRunResultSchema,
  combatSnapshotUnitSchema,
} from '../contracts/index.js'
import type { BattleAction, BattleTick } from '../combat.actions.js'

export {
  CANONICAL_SNAPSHOT_KEYS,
  CANONICAL_SNAPSHOT_KEY_SET,
  CANONICAL_ACTION_KEYS,
  CANONICAL_ACTION_KEY_SET,
}

const BATTLE_ACTION_ALLOWED_KEYS = new Set<string>([
  'unitId', 'type', 'targetId', 'damage', 'isCritical', 'isShieldHit',
  'fromX', 'fromY', 'toX', 'toY', 'facingAngle', 'isWalking', 'motionKind',
  'spawnType', 'spawnTeam', 'spawnMaxHp', 'hazardId', 'radius', 'statusType',
  'sourceUnitId', 'damageKind', 'cause', 'controlMode', 'stanceMode', 'modeState',
  'value', 'markEvent', 'markSquadId', 'markDuration', 'sourceUnitType', 'sourceTeam',
  'retargetCount', 'bonusDamage', 'impactId', 'launchTick', 'earliestLaunchTick',
  'impactTick', 'projectileKind', 'cancelReason',
])

export function sanitizeEventDetails(val: unknown): unknown {
  if (val === undefined) return undefined
  if (val === null || typeof val !== 'object') return val
  if (Array.isArray(val)) {
    return val.map(item => sanitizeEventDetails(item))
  }
  const cleanObj: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (!k.startsWith('_') && v !== undefined) {
      const sanitized = sanitizeEventDetails(v)
      if (sanitized !== undefined) {
        cleanObj[k] = sanitized
      }
    }
  }
  return cleanObj
}

function sanitizeSnapshotVelocity(val: unknown): unknown {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return val
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (!k.startsWith('_')) {
      clean[k] = typeof v === 'object' && v !== null ? sanitizeEventDetails(v) : v
    }
  }
  return clean
}

function sanitizeSnapshotStatusEffects(val: unknown): unknown {
  if (!Array.isArray(val)) return val
  return val.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    const clean: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
      if (!k.startsWith('_') && CANONICAL_STATUS_EFFECT_KEY_SET.has(k) && v !== undefined) {
        clean[k] = typeof v === 'object' && v !== null ? sanitizeEventDetails(v) : v
      }
    }
    return clean
  })
}

function sanitizeSnapshotTargetMark(val: unknown): unknown {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return val
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (!k.startsWith('_') && CANONICAL_TARGET_MARK_KEY_SET.has(k) && v !== undefined) {
      clean[k] = typeof v === 'object' && v !== null ? sanitizeEventDetails(v) : v
    }
  }
  return clean
}

export function serializeCombatUnitSnapshot(unit: unknown): CombatSnapshotUnit {
  const raw = unit as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(raw)) {
    if (CANONICAL_SNAPSHOT_KEY_SET.has(key) && raw[key] !== undefined) {
      if (key === 'velocity') {
        result[key] = sanitizeSnapshotVelocity(raw.velocity)
      } else if (key === 'statusEffects') {
        result[key] = sanitizeSnapshotStatusEffects(raw.statusEffects)
      } else if (key === 'targetMark') {
        result[key] = sanitizeSnapshotTargetMark(raw.targetMark)
      } else if (typeof raw[key] === 'object' && raw[key] !== null) {
        result[key] = sanitizeEventDetails(raw[key])
      } else {
        result[key] = raw[key]
      }
    }
  }
  return result as CombatSnapshotUnit
}

export function deserializeCombatUnitSnapshot(input: unknown): CombatSnapshotUnit {
  const sanitized = serializeCombatUnitSnapshot(input)
  combatSnapshotUnitSchema.parse(sanitized)
  return sanitized
}

export const serializeLegacyUnit = serializeCombatUnitSnapshot
export const deserializeLegacyUnit = deserializeCombatUnitSnapshot

export function serializeCombatEvent(action: unknown): CombatEvent {
  const act = action as Record<string, unknown>
  const event: Record<string, unknown> = {}
  for (const k of Object.keys(act)) {
    if (CANONICAL_ACTION_KEY_SET.has(k) && act[k] !== undefined) {
      event[k] = typeof act[k] === 'object' && act[k] !== null ? sanitizeEventDetails(act[k]) : act[k]
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

export function deserializeCombatEvent(event: unknown): CombatEvent {
  const sanitized = serializeCombatEvent(event)
  combatEventSchema.parse(sanitized)
  return sanitized
}

export function deserializeCombatAction(event: unknown): BattleAction {
  const raw = deserializeCombatEvent(event) as Record<string, unknown>
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

export function serializeCombatTick(tick: { tick: number; actions: readonly BattleAction[] }): CombatTick {
  return {
    tick: tick.tick,
    actions: tick.actions.map(serializeCombatEvent),
  }
}

export function deserializeCombatTick(tick: CombatTick): BattleTick {
  return {
    tick: tick.tick,
    actions: tick.actions.map(deserializeCombatAction),
  }
}

export function encodeLegacyReplayJson(result: CombatRunResult): string {
  return JSON.stringify(result)
}

export function decodeLegacyReplayJson(json: string): CombatRunResult {
  const parsed = JSON.parse(json) as Record<string, unknown>
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid replay JSON: expected object')
  }
  const initialState = Array.isArray(parsed.initialState)
    ? parsed.initialState.map(u => deserializeCombatUnitSnapshot(u))
    : parsed.initialState
  const survivors = Array.isArray(parsed.survivors)
    ? parsed.survivors.map(u => deserializeCombatUnitSnapshot(u))
    : parsed.survivors
  const logs = Array.isArray(parsed.logs)
    ? parsed.logs.map((t: unknown) => {
        if (!t || typeof t !== 'object' || Array.isArray(t)) return t
        const tickObj = t as Record<string, unknown>
        const actions = Array.isArray(tickObj.actions)
          ? tickObj.actions.map(deserializeCombatEvent)
          : tickObj.actions
        return {
          tick: tickObj.tick,
          actions,
        }
      })
    : parsed.logs

  const decoded: Record<string, unknown> = {
    winner: parsed.winner,
    seed: parsed.seed,
    elapsedTicks: parsed.elapsedTicks,
    terminationReason: parsed.terminationReason,
    initialState,
    survivors,
    logs,
    engineVersion: parsed.engineVersion,
    engineRevision: parsed.engineRevision,
    ...(parsed.profile !== undefined && typeof parsed.profile === 'object' ? { profile: parsed.profile as Record<string, unknown> } : (parsed.profile !== undefined ? { profile: parsed.profile } : {})),
    ...(parsed.metrics !== undefined && typeof parsed.metrics === 'object' ? { metrics: parsed.metrics as Record<string, unknown> } : (parsed.metrics !== undefined ? { metrics: parsed.metrics } : {})),
  }
  return combatRunResultSchema.parse(decoded)
}
