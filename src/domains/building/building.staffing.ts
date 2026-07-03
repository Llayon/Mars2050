import type { BuildingRow } from './building.types'
import { BUILDING_TYPES } from './building.config'
import type { PopulationState, PopulationTier } from '@/domains/population/population.types'

/**
 * Calculates the assigned workers for each building based on staffing mode, priority, and available population.
 * Does not mutate the DB directly, returns a map of building_id -> assigned_workers.
 */
export function allocateBuildingStaffing(
  buildings: BuildingRow[],
  population: PopulationState,
  reservedSlots: Partial<Record<PopulationTier, number>> = {}
): Record<string, number> {
  const result: Record<string, number> = {}

  // 1. Group available population by tier
  const availablePop: Record<PopulationTier, number> = {
    worker: Math.max(0, (population.workers || 0) - (reservedSlots.worker || 0)),
    technician: Math.max(0, (population.technicians || 0) - (reservedSlots.technician || 0)),
    scientist: Math.max(0, (population.scientists || 0) - (reservedSlots.scientist || 0)),
    director: Math.max(0, (population.directors || 0) - (reservedSlots.director || 0)),
  }

  // 2. Pre-fill result with 0 for all buildings
  for (const b of buildings) {
    result[b.id] = 0
  }

  // 3. Process manual buildings first
  for (const b of buildings) {
    const config = BUILDING_TYPES[b.type]
    if (!config || !config.staffing) continue
    if (b.paused || !b.is_active) continue

    if (b.staffing_mode === 'manual') {
      const tier = config.staffing.tier
      const maxSlots = config.staffing.slots
      // Requested workers can't exceed maxSlots
      const requested = Math.min(b.assigned_workers, maxSlots)
      const allocated = Math.min(requested, availablePop[tier])
      
      result[b.id] = allocated
      availablePop[tier] -= allocated
    }
  }

  // 4. Process auto buildings by priority
  const autoBuildings = buildings.filter(b => {
    const config = BUILDING_TYPES[b.type]
    return config?.staffing && b.is_active && !b.paused && b.staffing_mode === 'auto'
  })

  // Sort by priority (high -> normal -> low), then by determinism (id)
  const priorityScore: Record<string, number> = { high: 3, normal: 2, low: 1 }
  
  autoBuildings.sort((a, b) => {
    const pA = priorityScore[a.work_priority] || 2
    const pB = priorityScore[b.work_priority] || 2
    if (pA !== pB) return pB - pA // Descending priority
    return a.id.localeCompare(b.id) // Ascending ID fallback
  })

  // Allocate slots
  for (const b of autoBuildings) {
    const staffing = BUILDING_TYPES[b.type]?.staffing
    if (!staffing) continue
    const tier = staffing.tier
    const maxSlots = staffing.slots
    const minActiveSlots = staffing.minActiveSlots
    
    if (availablePop[tier] < minActiveSlots) continue
    const allocated = Math.min(maxSlots, availablePop[tier])
    result[b.id] = allocated
    availablePop[tier] -= allocated
  }

  return result
}
