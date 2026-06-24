import { z } from 'zod'

export const attackSchema = z.object({
  attackerColonyId: z.string().uuid('Invalid attacker colony ID'),
  defenderColonyId: z.string().uuid('Invalid defender colony ID'),
  clientSeed: z.number().int().min(0).max(2_147_483_647).optional(),
  attackerUnitsPlacement: z.array(z.object({
    unitId: z.string().uuid(),
    x: z.number().int().min(0).max(17),
    y: z.number().int().min(16).max(31),
  })).optional()
})

export const tradeSchema = z.object({
  fromColonyId: z.string().uuid('Invalid from colony ID'),
  toColonyId: z.string().uuid('Invalid to colony ID'),
  offerResources: z.record(z.string(), z.number().min(0)),
  requestResources: z.record(z.string(), z.number().min(0)).optional()
})

export const battleIdSchema = z.object({
  battleId: z.string().uuid('Invalid battle ID'),
})

export type AttackInput = z.infer<typeof attackSchema>
export type TradeInput = z.infer<typeof tradeSchema>
export type BattleIdInput = z.infer<typeof battleIdSchema>
