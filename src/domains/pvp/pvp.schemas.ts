import { z } from 'zod'
import { FIELD_HEIGHT, FIELD_WIDTH } from '@/domains/combat/combat.utils'
import { isInDeploymentZone } from '@/domains/combat/combat.deployment'

const attackDeploymentPointSchema = z.object({
  unitId: z.string().uuid(),
  x: z.number().int().min(0).max(FIELD_WIDTH),
  y: z.number().int().min(0).max(FIELD_HEIGHT),
}).strict().refine(point => isInDeploymentZone('attack', point.x, point.y), {
  message: 'Attacker units must be deployed in the attack zone',
})

export const attackSchema = z.object({
  attackerColonyId: z.string().uuid('Invalid attacker colony ID'),
  defenderColonyId: z.string().refine(val => val.startsWith('npc_') || z.string().uuid().safeParse(val).success, {
    message: 'Invalid defender colony ID (must be UUID or npc_ target)',
  }),
  clientSeed: z.number().int().min(0).max(2_147_483_647).optional(),
  attackerUnitsPlacement: z.array(attackDeploymentPointSchema).optional()
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
