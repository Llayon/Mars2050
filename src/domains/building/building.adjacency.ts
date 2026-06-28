import type { BuildingRow, BuildingTypeKey } from './building.types'

export interface AdjacencyRule {
  source: BuildingTypeKey
  neighbor: BuildingTypeKey
  productionMult: number  // +0.2 = +20%
}

export const ADJACENCY_RULES: AdjacencyRule[] = [
  { source: 'mine', neighbor: 'mine', productionMult: 0.2 },
  { source: 'greenhouse', neighbor: 'water_extractor', productionMult: 0.15 },
  { source: 'research_lab', neighbor: 'data_center', productionMult: 0.25 },
  { source: 'solar_panels', neighbor: 'solar_panels', productionMult: -0.1 },
  { source: 'nanoforge', neighbor: 'advanced_mine', productionMult: 0.3 },
  { source: 'workshop', neighbor: 'mine', productionMult: 0.15 },
]

/**
 * Calculates adjacency modifier for a building based on its neighbors.
 * Base modifier is 1.0. A modifier of 1.2 means +20% production.
 */
export function calculateAdjacencyModifier(
  building: BuildingRow,
  allBuildings: BuildingRow[],
): number {
  let mod = 1.0
  const neighbors = allBuildings.filter(b =>
    b.id !== building.id &&
    b.is_active && // Only active neighbors provide bonuses
    Math.abs(b.x - building.x) <= 1 &&
    Math.abs(b.y - building.y) <= 1
  )

  for (const n of neighbors) {
    const rule = ADJACENCY_RULES.find(r =>
      r.source === building.type && r.neighbor === n.type
    )
    if (rule) mod += rule.productionMult
  }

  return Math.max(0.1, mod) // Minimum 10% production regardless of penalties
}
