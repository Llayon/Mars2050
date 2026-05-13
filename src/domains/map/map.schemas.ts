import { z } from 'zod'

export const discoverLocationSchema = z.object({
  locationId: z.string().uuid('Invalid location ID'),
  colonyId: z.string().uuid('Invalid colony ID')
})

export type DiscoverLocationInput = z.infer<typeof discoverLocationSchema>