import { z } from 'zod'

export const e2eResetSchema = z.object({}).strict()

export type E2eResetInput = z.infer<typeof e2eResetSchema>
