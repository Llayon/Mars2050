import { BUILDING_TYPES } from './building.config'
import type { BuildingRow } from './building.types'
import type { PopulationState, PopulationTier } from '@/domains/population/population.types'
import type { TerrainCell } from '@/domains/colony/colony-terrain.types'
import { TERRAIN_BUILDING_MODIFIERS } from '@/domains/colony/colony-terrain.config'
import { calculateAdjacencyModifier } from './building.adjacency'

/**
 * Counts total job slots of a tier across all buildings.
 */
export function sumJobsForTier(
  tier: PopulationTier,
  buildings: BuildingRow[]
): number {
  return buildings.reduce((sum, b) => {
    const config = BUILDING_TYPES[b.type]
    if (!config || !b.is_active) return sum
    if (config.staffing?.tier === tier) return sum + config.staffing.slots
    return sum
  }, 0)
}

/**
 * Calculates effective production of a building considering workforce.
 */
export function getEffectiveProduction(
  building: BuildingRow,
  population: PopulationState | null,
  allBuildings: BuildingRow[],
  terrainGrid: TerrainCell[] = []
): { production: Record<string, number>, consumption: Record<string, number> } {
  const config = BUILDING_TYPES[building.type]
  if (!config) return { production: {}, consumption: {} }

  if (!building.is_active || building.paused) {
    return { production: {}, consumption: {} }
  }

  // 1. Staffing Efficiency (0..1)
  const totalSlots = config.staffing?.slots || 0
  const tier = config.staffing?.tier
  let fillRatio = 1

  if (totalSlots > 0) {
    const assignedWorkers = Math.max(0, building.assigned_workers)
    const minActiveSlots = config.staffing?.minActiveSlots ?? 1
    fillRatio = assignedWorkers < minActiveSlots ? 0 : Math.min(assignedWorkers / totalSlots, 1)
  }

  // 2. Happiness modifier
  let happinessMod = 1
  if (totalSlots > 0 && population && tier) {
    const hapField = `happiness_${tier}s` as keyof PopulationState
    const happiness = (population[hapField] as number) || 50
    // 100 hap = x2, 50 hap = x1, 25 hap = x0.5
    happinessMod = happiness / 50
  }

  // 3. Terrain modifier
  const cell = terrainGrid.find(c => c.x === building.x && c.y === building.y)
  const terrainMod = cell 
    ? 1 + (TERRAIN_BUILDING_MODIFIERS[cell.t]?.bonuses?.[building.type] ?? 0) - Math.abs(TERRAIN_BUILDING_MODIFIERS[cell.t]?.penalties?.[building.type] ?? 0)
    : 1

  // 4. Adjacency modifier
  const adjMod = calculateAdjacencyModifier(building, allBuildings)

  // Final modifier for production
  const totalMod = fillRatio * happinessMod * terrainMod * adjMod

  const production: Record<string, number> = {}
  for (const [res, base] of Object.entries(config.production || {})) {
    production[res] = base * totalMod
  }

  // Consumption scales only with fillRatio (no happiness bonus/penalty on consumption)
  const consumption: Record<string, number> = {}
  for (const [res, base] of Object.entries(config.consumption || {})) {
    consumption[res] = base * fillRatio
  }

  return { production, consumption }
}
