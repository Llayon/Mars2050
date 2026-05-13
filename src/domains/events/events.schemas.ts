import { z } from 'zod'

export const eventTypeEnum = z.enum([
  'dust_storm',
  'meteor_shower',
  'anomaly_discovered',
  'resource_vein',
  'cold_wave',
  'solar_flare',
])

export const createEventSchema = z.object({
  colony_id: z.string().uuid(),
  type: eventTypeEnum,
  duration_minutes: z.number().int().positive().optional(),
})

export const eventQuerySchema = z.object({
  colony_id: z.string().uuid(),
  active_only: z.boolean().optional(),
})
