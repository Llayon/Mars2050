import type { TerrainCell } from './colony-terrain.types'
import type { BuildingRow } from '@/domains/building/building.types'
import type { PopulationState } from '@/domains/population/population.types'
import type { ResourceRow } from '@/domains/resource/resource.types'

export interface Colony {
  id: string
  name: string
  level: number
  experience: number
  user_id: string
  last_calc_at: string
  created_at: string
  terrain_grid?: TerrainCell[]
  unlocked_radius?: number
}

export interface ColonyInitResult {
  success: boolean
  error?: string
  count?: number
}

export interface ColonyBootstrapPayload {
  colony: Colony
  resources: ResourceRow[]
  buildings: BuildingRow[]
  population: PopulationState | null
}
