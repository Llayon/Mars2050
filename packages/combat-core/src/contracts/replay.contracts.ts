import { z } from 'zod'
import {
  type CombatSnapshotUnit, type CombatEvent,
  CANONICAL_SNAPSHOT_KEY_SET, CANONICAL_ACTION_KEY_SET,
  CANONICAL_STATUS_EFFECT_KEY_SET, CANONICAL_TARGET_MARK_KEY_SET,
  ACTION_NUM_KEYS, ACTION_BOOL_KEYS, ACTION_STR_KEYS,
  SNAPSHOT_NUM_KEYS, SNAPSHOT_BOOL_KEYS, SNAPSHOT_STR_KEYS, SNAPSHOT_ARR_KEYS, SNAPSHOT_OBJ_KEYS,
} from './replay.types.js'
import {
  checkFinite, isObj, validateDeepNode, validateDetailsNode, validateSupportAuras,
  validateSnapshotArrayField, validateSnapshotObjectField,
} from './replay.nested-validators.js'
export * from './replay.types.js'
export { checkFinite, isObj } from './replay.nested-validators.js'

export const combatSnapshotUnitSchema: z.ZodType<CombatSnapshotUnit> = z
  .record(z.string(), z.unknown())
  .superRefine((data, ctx) => {
    if (typeof data.id !== 'string' || !data.id) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid id required' }); if (typeof data.type !== 'string' || !data.type) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid type required' })
    if (data.team !== 'attacker' && data.team !== 'defender') ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid team required' })
    if (!checkFinite(data.x) || !checkFinite(data.y) || !checkFinite(data.hp) || !checkFinite(data.maxHp) || (data.maxHp as number) <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid coordinates and hp required' })
    for (const key of Object.keys(data)) if (!CANONICAL_SNAPSHOT_KEY_SET.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed unit snapshot key: ${key}` })
    for (const f of SNAPSHOT_NUM_KEYS) if (data[f] !== undefined && !checkFinite(data[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for ${f}` })
    const nonNeg = ['attack', 'speed', 'range', 'shield', 'maxShield', 'turnSpeed', 'actionCooldownMax', 'actionCooldown'] as const
    for (const f of nonNeg) if (data[f] !== undefined && (data[f] as number) < 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for ${f}` })
    if (data.size !== undefined && data.size !== 'S' && data.size !== 'M' && data.size !== 'L' && data.size !== 'XL') ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid unit size' })
    for (const f of SNAPSHOT_BOOL_KEYS) if (data[f] !== undefined && typeof data[f] !== 'boolean') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid boolean for ${f}` })
    for (const f of SNAPSHOT_STR_KEYS) if (data[f] !== undefined && typeof data[f] !== 'string') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid string for ${f}` })
    for (const f of SNAPSHOT_ARR_KEYS) if (data[f] !== undefined) validateSnapshotArrayField(f, data[f], ctx)
    for (const f of SNAPSHOT_OBJ_KEYS) if (data[f] !== undefined) validateSnapshotObjectField(f, data[f], ctx)
    if (data.supportAuras !== undefined) validateSupportAuras(data.supportAuras, ctx)
    if (data.statusEffects !== undefined) {
      if (!Array.isArray(data.statusEffects)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'statusEffects must be an array' })
      else for (const s of data.statusEffects) {
        if (!isObj(s) || typeof s.type !== 'string' || !s.type || !checkFinite(s.duration)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid statusEffect item' })
        } else {
          for (const k of Object.keys(s)) if (!CANONICAL_STATUS_EFFECT_KEY_SET.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed statusEffect key: ${k}` })
          for (const sf of ['sourceId', 'sourceUnitId', 'stackKey', 'controlMode', 'sourceUnitType', 'sourceTeam', 'damageType', 'sourceUpgradeId'] as const) {
            if (s[sf] !== undefined && typeof s[sf] !== 'string') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid statusEffect ${sf}: expected string` })
          }
          for (const nf of ['value', 'tickInterval', 'nextTickIn', 'maxStacks', 'elapsedTicks', 'appliedAtTick', 'shieldAmount'] as const) {
            if (s[nf] !== undefined && !checkFinite(s[nf])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid statusEffect ${nf}` })
          }
        }
      }
    }
    if (data.targetMark !== undefined) {
      if (!isObj(data.targetMark)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'targetMark must be an object' })
      else {
        for (const k of Object.keys(data.targetMark)) if (!CANONICAL_TARGET_MARK_KEY_SET.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed targetMark key: ${k}` })
        for (const sf of ['sourceUnitId', 'squadId', 'retargetPolicy'] as const) if (data.targetMark[sf] !== undefined && typeof data.targetMark[sf] !== 'string') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid targetMark ${sf}: expected string` })
        for (const bf of ['sharedDamage', 'squadWide'] as const) if (data.targetMark[bf] !== undefined && typeof data.targetMark[bf] !== 'boolean') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid targetMark ${bf}: expected boolean` })
        for (const mf of ['duration', 'markDuration', 'damageMultiplier', 'executeThreshold', 'focusPriority', 'focusRadius', 'retargetLockTicks'] as const) {
          if (data.targetMark[mf] !== undefined && !checkFinite(data.targetMark[mf])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid targetMark ${mf}` })
        }
      }
    }
    if (data.velocity !== undefined) {
      if (!isObj(data.velocity)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'velocity must be an object' })
      else {
        if (!checkFinite(data.velocity.x) || !checkFinite(data.velocity.y)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid velocity coordinates' })
        for (const vk of Object.keys(data.velocity)) if (vk !== 'x' && vk !== 'y') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed velocity key: ${vk}` })
      }
    }
  }) as unknown as z.ZodType<CombatSnapshotUnit>
export const combatReplayUnitSchema = combatSnapshotUnitSchema
export const combatEventSchema: z.ZodType<CombatEvent> = z
  .record(z.string(), z.unknown())
  .superRefine((data, ctx) => {
    if (typeof data.type !== 'string' || !data.type) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid type required' })
    for (const key of Object.keys(data)) if (!CANONICAL_ACTION_KEY_SET.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed combat event key: ${key}` })
    for (const f of ACTION_NUM_KEYS) if (data[f] !== undefined && !checkFinite(data[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for ${f}` })
    for (const f of ACTION_BOOL_KEYS) if (data[f] !== undefined && typeof data[f] !== 'boolean') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid boolean for ${f}` })
    for (const f of ACTION_STR_KEYS) if (data[f] !== undefined && typeof data[f] !== 'string') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid string value for ${f}` })
    if (data.type === 'move' && (!data.unitId && !data.sourceId && !data.sourceUnitId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Move event requires unitId or sourceId' })
    if (data.spawnTeam !== undefined && data.spawnTeam !== 'attacker' && data.spawnTeam !== 'defender') ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid spawnTeam: expected "attacker" | "defender"' })
    if (data.spawnMaxHp !== undefined && (!checkFinite(data.spawnMaxHp) || (data.spawnMaxHp as number) <= 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid spawnMaxHp: expected positive finite number' })
    if (data.details !== undefined) {
      if (!isObj(data.details)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'details must be an object' })
      else validateDetailsNode(data.details, ctx, 'details')
    }
  }) as unknown as z.ZodType<CombatEvent>

export const combatTickSchema = z.object({ tick: z.number().int().nonnegative(), actions: z.array(combatEventSchema) })
export type CombatTick = z.infer<typeof combatTickSchema>
