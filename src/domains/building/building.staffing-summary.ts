import { POPULATION_TIERS } from '@/domains/population/population.config'
import type { PopulationState, PopulationTier } from '@/domains/population/population.types'
import { BUILDING_TYPES } from './building.config'
import { allocateBuildingStaffing } from './building.staffing'
import type { BuildingRow, BuildingStaffingMode, BuildingTypeKey, BuildingWorkPriority } from './building.types'

export type StaffingStatus = 'inactive' | 'paused' | 'blocked' | 'partial' | 'full'

export interface StaffingTierSummary {
  tier: PopulationTier
  population: number
  reservedSlots: number
  assignedSlots: number
  requiredSlots: number
  freeSlots: number
}

export interface StaffingBuildingSummary {
  id: string
  type: BuildingTypeKey
  name: string
  tier: PopulationTier
  slots: number
  minActiveSlots: number
  assignedSlots: number
  requestedSlots: number
  efficiency: number
  staffingMode: BuildingStaffingMode
  workPriority: BuildingWorkPriority
  paused: boolean
  isActive: boolean
  status: StaffingStatus
}

export interface StaffingManagementSummary {
  tiers: StaffingTierSummary[]
  buildings: StaffingBuildingSummary[]
}

const TIERS: PopulationTier[] = ['worker', 'technician', 'scientist', 'director']

function populationCount(population: PopulationState | null, tier: PopulationTier): number {
  if (!population) return 0
  return population[`${tier}s` as keyof PopulationState] as number
}

function staffingStatus(building: BuildingRow, assigned: number, slots: number, minActiveSlots: number): StaffingStatus {
  if (!building.is_active) return 'inactive'
  if (building.paused) return 'paused'
  if (assigned < minActiveSlots) return 'blocked'
  if (assigned < slots) return 'partial'
  return 'full'
}

/**
 * Builds colony-wide staffing rows and tier totals from current building state.
 */
export function buildStaffingManagementSummary(
  buildings: BuildingRow[],
  population: PopulationState | null,
  reservedSlots: Partial<Record<PopulationTier, number>> = {},
): StaffingManagementSummary {
  const assignments = population ? allocateBuildingStaffing(buildings, population, reservedSlots) : {}
  const tierTotals = TIERS.reduce<Record<PopulationTier, StaffingTierSummary>>((acc, tier) => {
    acc[tier] = {
      tier,
      population: populationCount(population, tier),
      reservedSlots: reservedSlots[tier] || 0,
      assignedSlots: 0,
      requiredSlots: 0,
      freeSlots: 0,
    }
    return acc
  }, {} as Record<PopulationTier, StaffingTierSummary>)

  const staffingBuildings = buildings.flatMap<StaffingBuildingSummary>(building => {
    const config = BUILDING_TYPES[building.type]
    const staffing = config?.staffing
    if (!staffing || staffing.slots <= 0) return []

    const assignedSlots = assignments[building.id] ?? 0
    const requestedSlots = building.staffing_mode === 'manual'
      ? Math.min(building.assigned_workers, staffing.slots)
      : staffing.slots
    const activeDemand = building.is_active && !building.paused ? staffing.slots : 0
    tierTotals[staffing.tier].assignedSlots += assignedSlots
    tierTotals[staffing.tier].requiredSlots += activeDemand

    return [{
      id: building.id,
      type: building.type,
      name: building.name || config.name,
      tier: staffing.tier,
      slots: staffing.slots,
      minActiveSlots: staffing.minActiveSlots,
      assignedSlots,
      requestedSlots,
      efficiency: staffing.slots > 0 ? assignedSlots / staffing.slots : 1,
      staffingMode: building.staffing_mode,
      workPriority: building.work_priority,
      paused: building.paused,
      isActive: building.is_active,
      status: staffingStatus(building, assignedSlots, staffing.slots, staffing.minActiveSlots),
    }]
  })

  for (const tier of TIERS) {
    const totals = tierTotals[tier]
    totals.freeSlots = Math.max(0, totals.population - totals.reservedSlots - totals.assignedSlots)
  }

  return {
    tiers: TIERS.map(tier => tierTotals[tier]),
    buildings: staffingBuildings.sort((a, b) => {
      const tierDiff = TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier)
      if (tierDiff !== 0) return tierDiff
      return POPULATION_TIERS[a.tier].name.localeCompare(POPULATION_TIERS[b.tier].name) || a.name.localeCompare(b.name)
    }),
  }
}
