import { z } from 'zod'

export const workOrderTypeSchema = z.enum([
  'clear_rubble',
  'repair_grid',
  'survey_anomaly',
  'trade_manifest',
])

export const workOrderQuerySchema = z.object({
  colonyId: z.string().uuid('Invalid colony ID'),
})

export const startWorkOrderSchema = z.object({
  colonyId: z.string().uuid('Invalid colony ID'),
  type: workOrderTypeSchema,
})

export const claimWorkOrderSchema = z.object({
  colonyId: z.string().uuid('Invalid colony ID'),
  workOrderId: z.string().uuid('Invalid work order ID'),
  action: z.literal('claim'),
})

export type WorkOrderQueryInput = z.infer<typeof workOrderQuerySchema>
export type StartWorkOrderInput = z.infer<typeof startWorkOrderSchema>
export type ClaimWorkOrderInput = z.infer<typeof claimWorkOrderSchema>
