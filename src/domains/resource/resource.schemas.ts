import { z } from 'zod'

/** Schema for resource amount update. */
export const resourceUpdateSchema = z.object({
  colonyId: z.string().uuid('Invalid colony ID'),
  resourceType: z.enum([
    'oxygen', 'water', 'energy', 'minerals', 'food', 'research_points'
  ], { message: 'Invalid resource type' }),
  amount: z.number().min(0, 'Amount must be non-negative'),
  operation: z.enum(['add', 'subtract', 'set'], { message: 'Invalid operation' })
})

export const resourceDebugQuerySchema = z.object({
  colonyId: z.string().uuid('Invalid colony ID'),
})

export type ResourceUpdateInput = z.infer<typeof resourceUpdateSchema>
export type ResourceDebugQueryInput = z.infer<typeof resourceDebugQuerySchema>
