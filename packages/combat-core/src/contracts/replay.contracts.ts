import { z } from 'zod'
import type { Team } from './unit.contracts.js'

export interface CombatSnapshotUnit {
  id: string
  team: Team
  type: string
  x: number
  y: number
  hp: number
  maxHp: number
  speed?: number
  range?: number
  attack?: number
  [key: string]: unknown
}

export const combatSnapshotUnitSchema: z.ZodType<CombatSnapshotUnit> = z
  .record(z.string(), z.unknown())
  .superRefine((data, ctx) => {
    if (typeof data.id !== 'string' || data.id.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid id required' })
    }
    if (typeof data.type !== 'string' || data.type.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid type required' })
    }
    if (data.team !== 'attacker' && data.team !== 'defender') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid team required' })
    }
    if (typeof data.x !== 'number' || typeof data.y !== 'number') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid coordinates required' })
    }
    if (typeof data.hp !== 'number' || typeof data.maxHp !== 'number') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid hp required' })
    }
  }) as unknown as z.ZodType<CombatSnapshotUnit>

export const combatReplayUnitSchema = combatSnapshotUnitSchema
export type CombatReplayUnit = CombatSnapshotUnit

export interface CombatEvent {
  type: string
  unitId?: string
  sourceId?: string
  targetId?: string
  x?: number
  y?: number
  amount?: number
  [key: string]: unknown
}

export const combatEventSchema: z.ZodType<CombatEvent> = z
  .record(z.string(), z.unknown())
  .superRefine((data, ctx) => {
    if (typeof data.type !== 'string' || data.type.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid type required' })
    }
  }) as unknown as z.ZodType<CombatEvent>

export const combatTickSchema = z.object({
  tick: z.number().int().nonnegative(),
  actions: z.array(combatEventSchema),
})
export type CombatTick = z.infer<typeof combatTickSchema>


