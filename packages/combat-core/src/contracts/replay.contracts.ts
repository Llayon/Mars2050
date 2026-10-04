import { z } from 'zod'
import {
  type CombatSnapshotUnit,
  type CombatEvent,
  CANONICAL_SNAPSHOT_KEY_SET,
  CANONICAL_ACTION_KEY_SET,
} from './replay.types.js'

export * from './replay.types.js'

const checkFinite = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v)

export const combatSnapshotUnitSchema: z.ZodType<CombatSnapshotUnit> = z
  .record(z.string(), z.unknown())
  .superRefine((data, ctx) => {
    if (typeof data.id !== 'string' || !data.id) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid id required' })
    if (typeof data.type !== 'string' || !data.type) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid type required' })
    if (data.team !== 'attacker' && data.team !== 'defender') ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid team required' })
    if (!checkFinite(data.x) || !checkFinite(data.y)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid coordinates required' })
    if (!checkFinite(data.hp) || !checkFinite(data.maxHp) || (data.maxHp as number) <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid hp required' })
    }
    for (const key of Object.keys(data)) {
      if (!CANONICAL_SNAPSHOT_KEY_SET.has(key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed unit snapshot key: ${key}` })
      }
    }
    const nonNegativeStats = ['attack', 'defense', 'speed', 'range', 'shield', 'maxShield', 'turnSpeed'] as const
    for (const f of nonNegativeStats) {
      if (data[f] !== undefined && (!checkFinite(data[f]) || (data[f] as number) < 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for ${f}` })
      }
    }
    const finiteFields = ['currentAngle', 'initialAngle', 'offsetX', 'offsetY'] as const
    for (const f of finiteFields) {
      if (data[f] !== undefined && !checkFinite(data[f])) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for ${f}` })
      }
    }
    if (data.statusEffects !== undefined) {
      if (!Array.isArray(data.statusEffects)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'statusEffects must be an array' })
      } else {
        for (const s of data.statusEffects) {
          if (!s || typeof s !== 'object' || typeof (s as Record<string, unknown>).type !== 'string' || !checkFinite((s as Record<string, unknown>).duration)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid statusEffect item' })
          }
        }
      }
    }
    if (data.velocity !== undefined) {
      if (!data.velocity || typeof data.velocity !== 'object' || Array.isArray(data.velocity)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'velocity must be an object' })
      } else {
        const vel = data.velocity as Record<string, unknown>
        if (!checkFinite(vel.x) || !checkFinite(vel.y)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid velocity coordinates' })
        for (const vk of Object.keys(vel)) {
          if (vk !== 'x' && vk !== 'y') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed velocity key: ${vk}` })
        }
      }
    }
  }) as unknown as z.ZodType<CombatSnapshotUnit>

export const combatReplayUnitSchema = combatSnapshotUnitSchema

export const combatEventSchema: z.ZodType<CombatEvent> = z
  .record(z.string(), z.unknown())
  .superRefine((data, ctx) => {
    if (typeof data.type !== 'string' || !data.type) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid type required' })
    for (const key of Object.keys(data)) {
      if (!CANONICAL_ACTION_KEY_SET.has(key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed combat event key: ${key}` })
      }
    }
    const numFields = ['x', 'y', 'toX', 'toY', 'fromX', 'fromY', 'amount', 'damage', 'value', 'facingAngle'] as const
    for (const f of numFields) {
      if (data[f] !== undefined && !checkFinite(data[f])) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for ${f}` })
      }
    }
  }) as unknown as z.ZodType<CombatEvent>

export const combatTickSchema = z.object({
  tick: z.number().int().nonnegative(),
  actions: z.array(combatEventSchema),
})
export type CombatTick = z.infer<typeof combatTickSchema>


