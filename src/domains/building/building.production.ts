import { BUILDING_TYPES } from './building.config'
import type { BuildingRow } from './building.types'
import type { PopulationState, PopulationTier } from '@/domains/population/population.types'
import type { TerrainCell } from '@/domains/colony/colony-terrain.types'

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
    if (config.workforce.tier === tier) return sum + config.workforce.count
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

  if (!building.is_active) {
    return { production: {}, consumption: {} }
  }

  // 1. Workforce ratio (0..1)
  const requiredWorkers = config.workforce.count
  let fillRatio = 1

  if (requiredWorkers > 0 && population) {
    const tierField = `${config.workforce.tier}s` as keyof PopulationState
    const totalTierPop = (population[tierField] as number) || 0
    const totalTierJobs = sumJobsForTier(config.workforce.tier, allBuildings)
    
    if (totalTierJobs > 0) {
      fillRatio = Math.min(totalTierPop / totalTierJobs, 1)
    }
  } else if (requiredWorkers > 0 && !population) {
    fillRatio = 0 // Needs workers but no population data available
  }

  // 2. Happiness modifier
  let happinessMod = 1
  if (requiredWorkers > 0 && population) {
    const hapField = `happiness_${config.workforce.tier}s` as keyof PopulationState
    const happiness = (population[hapField] as number) || 50
    // 100 hap = x2, 50 hap = x1, 25 hap = x0.5
    happinessMod = happiness / 50
  }

  // 3. Terrain modifier
  // const cell = terrainGrid.find(c => c.x === building.x && c.y === building.y)
  // const terrainMod = 1 // TODO: add TERRAIN_BUILDING_MODIFIERS when implemented
  const terrainMod = 1

  // 4. Adjacency modifier
  // const adjMod = calculateAdjacencyModifier(building, allBuildings)
  const adjMod = 1

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
