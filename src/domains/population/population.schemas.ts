import { z } from 'zod'

export const upgradePopulationSchema = z.object({
  colonyId: z.string().uuid('Некорректный ID колонии'),
  fromTier: z.enum(['worker', 'technician', 'scientist']),
  count: z.number().int().min(1, 'Количество должно быть больше 0')
})

export type UpgradePopulationDto = z.infer<typeof upgradePopulationSchema>
