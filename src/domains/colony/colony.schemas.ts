import { z } from 'zod'

export const colonyInitSchema = z.object({
  colonyId: z.string().uuid('Invalid colony ID')
})

export const colonyCreateSchema = z.object({
  userId: z.string().uuid('Invalid user ID')
})

export type ColonyInitInput = z.infer<typeof colonyInitSchema>
export type ColonyCreateInput = z.infer<typeof colonyCreateSchema>