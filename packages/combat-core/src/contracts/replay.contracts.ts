import { z } from 'zod'
import { teamSchema } from './unit.contracts.js'

export const combatReplayUnitSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  team: teamSchema,
  hp: z.number().nonnegative(),
  maxHp: z.number().positive(),
  x: z.number(),
  y: z.number(),
  attack: z.number().nonnegative(),
  range: z.number().nonnegative(),
  speed: z.number().nonnegative(),
  squadId: z.string().optional(),
  squadLeader: z.boolean().optional(),
  isTemporary: z.boolean().optional(),
  summonOwnerId: z.string().optional(),
  summonSourceId: z.string().optional(),
  shield: z.number().nonnegative().optional(),
  maxShield: z.number().nonnegative().optional(),
  direction: z.string().optional(),
  targetId: z.string().nullable().optional(),
})
export type CombatReplayUnit = z.infer<typeof combatReplayUnitSchema>

export const combatEventSchema = z.object({
  type: z.string().min(1),
  sourceId: z.string().optional(),
  targetId: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  amount: z.number().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
}).passthrough()
export type CombatEvent = z.infer<typeof combatEventSchema>

export const combatTickSchema = z.object({
  tick: z.number().int().nonnegative(),
  actions: z.array(combatEventSchema),
})
export type CombatTick = z.infer<typeof combatTickSchema>
