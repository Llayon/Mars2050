import type { TerrainCell } from './colony-terrain.types'

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