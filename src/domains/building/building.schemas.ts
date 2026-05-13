import { z } from 'zod'

/** Schema for creating a building. */
export const buildingCreateSchema = z.object({
  colonyId: z.string().uuid('Invalid colony ID'),
  type: z.enum([
    'solar_panels',
    'oxygen_generator',
    'water_extractor',
    'mine',
    'greenhouse',
    'research_lab'
  ], { message: 'Invalid building type' }),
  name: z.string().min(1, 'Name is required').max(50, 'Name too long')
})

/** Schema for updating a building level. */
export const buildingUpdateSchema = z.object({
  buildingId: z.string().uuid('Invalid building ID'),
  level: z.number().int().min(1).optional(),
  isActive: z.boolean().optional()
})

/** Schema for deleting a building. */
export const buildingDeleteSchema = z.object({
  buildingId: z.string().uuid('Invalid building ID')
})

/** Inferred types from schemas. */
export type BuildingCreateInput = z.infer<typeof buildingCreateSchema>
export type BuildingUpdateInput = z.infer<typeof buildingUpdateSchema>
export type BuildingDeleteInput = z.infer<typeof buildingDeleteSchema>