import type { PopulationTier } from '@/domains/population/population.types'
import type { ResourceTypeKey } from '@/domains/resource/resource.types'

export type WorkOrderType = 'clear_rubble' | 'repair_grid' | 'survey_anomaly' | 'trade_manifest'
export type WorkOrderStatus = 'active' | 'completed' | 'claimed'

export type ResourceAmountMap = Partial<Record<ResourceTypeKey, number>>

export interface WorkOrderConfig {
  name: string
  description: string
  assignedTier: PopulationTier
  assignedSlots: number
  durationMinutes: number
  cost: ResourceAmountMap
  reward: ResourceAmountMap
}

export interface WorkOrderRow {
  id: string
  colony_id: string
  type: WorkOrderType
  status: WorkOrderStatus
  assigned_tier: PopulationTier
  assigned_slots: number
  cost: ResourceAmountMap
  reward: ResourceAmountMap
  started_at: string
  completes_at: string
  claimed_at: string | null
  created_at: string
  updated_at: string
}
