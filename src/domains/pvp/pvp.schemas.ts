import { z } from 'zod'

export const attackSchema = z.object({
  attackerColonyId: z.string().uuid('Invalid attacker colony ID'),
  defenderColonyId: z.string().uuid('Invalid defender colony ID'),
})

export const tradeSchema = z.object({
  fromColonyId: z.string().uuid('Invalid from colony ID'),
  toColonyId: z.string().uuid('Invalid to colony ID'),
  offerResources: z.record(z.string(), z.number().min(0)),
  requestResources: z.record(z.string(), z.number().min(0)).optional()
})

export type AttackInput = z.infer<typeof attackSchema>
export type TradeInput = z.infer<typeof tradeSchema>