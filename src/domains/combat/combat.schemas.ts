import { z } from 'zod'

export const hireUnitSchema = z.object({
  colonyId: z.string().uuid(),
  unitType: z.enum(['marine', 'exosuit', 'sniper', 'medic', 'rocketeer', 'engineer', 'wall', 'turret']),
})

export const upgradeUnitSchema = z.object({
  colonyId: z.string().uuid(),
  unitId: z.string().uuid(),
  branch: z.enum(['A', 'B'])
})

export const dismissUnitSchema = z.object({
  colonyId: z.string().uuid(),
  unitId: z.string().uuid(),
})

export const setGarrisonSchema = z.object({
  colonyId: z.string().uuid(),
  units: z.array(z.object({
    unitId: z.string().uuid(),
    x: z.number().int().min(0).max(17),
    y: z.number().int().min(0).max(15),
  }))
})
