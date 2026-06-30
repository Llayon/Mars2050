import { z } from 'zod'
import { FIELD_HEIGHT, FIELD_WIDTH } from './combat.utils'
import { isInDeploymentZone } from './combat.deployment'

const defenseDeploymentPointSchema = z.object({
  unitId: z.string().uuid(),
  x: z.number().int().min(0).max(FIELD_WIDTH),
  y: z.number().int().min(0).max(FIELD_HEIGHT),
}).strict().refine(point => isInDeploymentZone('defense', point.x, point.y), {
  message: 'Garrison units must be deployed in the defense zone',
})

export const hireUnitSchema = z.object({
  colonyId: z.string().uuid(),
  unitType: z.string().min(1),
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
  units: z.array(defenseDeploymentPointSchema)
})
