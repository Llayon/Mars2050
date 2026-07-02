import type { ResourceTypeKey } from '@/domains/resource/resource.types'

import type { PopulationTier } from '@/domains/population/population.types'
import type { TerrainType } from '@/domains/colony/colony-terrain.types'

export type BuildingStaffingMode = 'auto' | 'manual'
export type BuildingWorkPriority = 'low' | 'normal' | 'high'

/** Represents a building type definition with cost and production rates. */
export interface BuildingType {
  name: string
  cost: ResourceCost
  production: ResourceProduction
  consumption: ResourceProduction
  description: string
  width: number
  height: number
  staffing?: {
    tier: PopulationTier
    slots: number
    minActiveSlots: number
  }
  requiresTerrain?: TerrainType[]
  unlockedByTier?: PopulationTier
  unlockedByBuilding?: BuildingTypeKey
}

/** Keys for all available building types. */
export type BuildingTypeKey =
  // Tier 1
  | 'solar_panels'
  | 'oxygen_generator'
  | 'water_extractor'
  | 'mine'
  | 'greenhouse'
  | 'research_lab'
  | 'habitat'
  | 'community_hall'
  // Tier 2
  | 'workshop'
  | 'advanced_mine'
  | 'geothermal_plant'
  | 'vehicle_bay'
  | 'habitat_mk2'
  // Tier 3
  | 'biotech_lab'
  | 'data_center'
  | 'nanoforge'
  | 'university'
  | 'habitat_mk3'
  // Tier 4
  | 'hq'
  | 'spaceport'
  | 'military_academy'
  | 'executive_dome'

/** Resource cost mapping (resource type → amount). */
export type ResourceCost = Partial<Record<ResourceTypeKey, number>>

/** Resource production/consumption mapping. */
export type ResourceProduction = Partial<Record<ResourceTypeKey, number>>

/** DB row for buildings table. */
export interface BuildingRow {
  id: string
  colony_id: string
  type: BuildingTypeKey
  name: string
  level: number
  is_active: boolean
  x: number
  y: number
  group_id?: string | null
  staffing_mode: BuildingStaffingMode
  assigned_workers: number
  work_priority: BuildingWorkPriority
  paused: boolean
  created_at: string
  updated_at: string
}

export type BuildingSettingsUpdate = Partial<Pick<BuildingRow, 'staffing_mode' | 'assigned_workers' | 'work_priority' | 'paused'>>

/** DTO for creating a new building. */
export interface BuildingCreateDTO {
  colonyId: string
  type: BuildingTypeKey
  name: string
  x: number
  y: number
  group_id?: string
}

/** API response for building creation. */
export interface BuildingResponse {
  building: BuildingRow | null
  error: string | null
  status: number
}
