import { z } from 'zod'
import {
  type CombatSnapshotUnit,
  type CombatEvent,
  CANONICAL_SNAPSHOT_KEY_SET,
  CANONICAL_ACTION_KEY_SET,
  CANONICAL_STATUS_EFFECT_KEY_SET,
  CANONICAL_TARGET_MARK_KEY_SET,
} from './replay.types.js'

export * from './replay.types.js'

const checkFinite = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v)
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export const combatSnapshotUnitSchema: z.ZodType<CombatSnapshotUnit> = z
  .record(z.string(), z.unknown())
  .superRefine((data, ctx) => {
    if (typeof data.id !== 'string' || !data.id) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid id required' }); if (typeof data.type !== 'string' || !data.type) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid type required' })
    if (data.team !== 'attacker' && data.team !== 'defender') ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid team required' })
    if (!checkFinite(data.x) || !checkFinite(data.y)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid coordinates required' })
    if (!checkFinite(data.hp) || !checkFinite(data.maxHp) || (data.maxHp as number) <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid hp required' })
    }
    for (const key of Object.keys(data)) {
      if (!CANONICAL_SNAPSHOT_KEY_SET.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed unit snapshot key: ${key}` })
    }
    const nonNeg = ['attack', 'speed', 'range', 'shield', 'maxShield', 'turnSpeed', 'actionCooldownMax', 'actionCooldown'] as const
    for (const f of nonNeg) if (data[f] !== undefined && (!checkFinite(data[f]) || (data[f] as number) < 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for ${f}` })
    const finiteFields = ['currentAngle', 'initialAngle', 'offsetX', 'offsetY', 'defense'] as const
    for (const f of finiteFields) {
      if (data[f] !== undefined && !checkFinite(data[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for ${f}` })
    }
    if (data.statusEffects !== undefined) {
      if (!Array.isArray(data.statusEffects)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'statusEffects must be an array' })
      else for (const s of data.statusEffects) {
        if (!isObj(s) || typeof s.type !== 'string' || !checkFinite(s.duration)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid statusEffect item' })
        } else {
          for (const k of Object.keys(s)) if (!CANONICAL_STATUS_EFFECT_KEY_SET.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed statusEffect key: ${k}` })
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
    for (const key of Object.keys(data)) {
      if (!CANONICAL_ACTION_KEY_SET.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed combat event key: ${key}` })
    }
    const numFields = ['x', 'y', 'toX', 'toY', 'fromX', 'fromY', 'amount', 'damage', 'value', 'facingAngle'] as const
    for (const f of numFields) {
      if (data[f] !== undefined && !checkFinite(data[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for ${f}` })
    }
    if (data.details !== undefined) {
      if (!isObj(data.details)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'details must be an object' })
      else {
        const checkNode = (n: unknown) => {
          if (Array.isArray(n)) {
            for (const it of n) if (typeof it === 'number' && !Number.isFinite(it)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid number in details' }); else if (typeof it === 'object' && it !== null) checkNode(it)
          } else if (isObj(n)) {
            for (const [k, v] of Object.entries(n)) {
              if (k.startsWith('_')) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed private key in details: ${k}` })
              if (typeof v === 'number' && !Number.isFinite(v)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid number in details: ${k}` })
              else if (typeof v === 'object' && v !== null) checkNode(v)
            }
          }
        }
        checkNode(data.details)
      }
    }
  }) as unknown as z.ZodType<CombatEvent>

export const combatTickSchema = z.object({ tick: z.number().int().nonnegative(), actions: z.array(combatEventSchema) })
export type CombatTick = z.infer<typeof combatTickSchema>
