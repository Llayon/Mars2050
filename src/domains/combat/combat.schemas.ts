import { z } from 'zod'

export const hireUnitSchema = z.object({
  unitType: z.enum(['marine', 'exosuit', 'sniper', 'medic', 'rocketeer', 'engineer']),
})

export const upgradeUnitSchema = z.object({
  unitId: z.string().uuid(),
  branch: z.enum(['A', 'B'])
})

export const dismissUnitSchema = z.object({
  unitId: z.string().uuid(),
})

export const setGarrisonSchema = z.object({
  units: z.array(z.object({
    unitId: z.string().uuid(),
    x: z.number().int().min(0).max(6),
    y: z.number().int().min(0).max(3),
  }))
})
