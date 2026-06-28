import { ResourceTypeKey } from '@/domains/resource/resource.types'

/** Population tiers (Anno-style) */
export type PopulationTier = 'worker' | 'technician' | 'scientist' | 'director'

/** Needs of a single tier per 10 population */
export interface TierNeed {
  resource: ResourceTypeKey
  amountPer10: number
  category: 'basic' | 'comfort' | 'luxury'
}

/** Configuration for a single tier */
export interface TierConfig {
  name: string
  icon: string
  needs: TierNeed[]
  housingPerBuilding: Record<string, number>
  upgradeBuilding: string | null
  workforceFor: string[]
}

/** DB row mapping for the population table */
export interface PopulationState {
  id?: string
  colony_id: string
  workers: number
  technicians: number
  scientists: number
  directors: number
  happiness_workers: number
  happiness_technicians: number
  happiness_scientists: number
  happiness_directors: number
  growth_progress: number
  updated_at?: string
}
