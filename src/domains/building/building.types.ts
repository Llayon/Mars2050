import type { ResourceTypeKey } from '@/domains/resource/resource.types'

import type { PopulationTier } from '@/domains/population/population.types'
import type { ColonyTerrain } from '@/domains/colony/colony-terrain.types'

/** Represents a building type definition with cost and production rates. */
export interface BuildingType {
  name: string
  cost: ResourceCost
  production: ResourceProduction
  consumption: ResourceProduction
  description: string
  width: number
  height: number
  workforce: {
    tier: PopulationTier
    count: number
  }
  requiresTerrain?: ColonyTerrain[]
  unlockedByTier?: PopulationTier
  unlockedByBuilding?: BuildingTypeKey
}

/** Keys for all available building types. */
export type BuildingTypeKey =
  | 'solar_panels'
  | 'oxygen_generator'
  | 'water_extractor'
  | 'mine'
  | 'greenhouse'
  | 'research_lab'
  | 'habitat'

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
  created_at: string
  updated_at: string
}

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