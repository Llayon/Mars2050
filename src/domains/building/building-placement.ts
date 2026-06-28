import { TerrainCell, TerrainType } from '@/domains/colony/colony-terrain.types'
import { COLONY_GRID_SIZE } from '@/domains/colony/colony-terrain.config'

export interface PlacementValidationInput {
  x: number
  y: number
  width: number
  height: number
  unlockedRadius: number
  terrainGrid: TerrainCell[]
  occupiedCells: { x: number, y: number, width: number, height: number }[]
  requiredTerrain?: TerrainType[]
}

/**
 * Pure function to validate if a building can be placed at the given coordinates.
 */
export function validateBuildingPlacement(input: PlacementValidationInput): { valid: boolean; error?: string } {
  const { x, y, width, height, unlockedRadius, terrainGrid, occupiedCells, requiredTerrain } = input

  // 1. Bounds check
  if (x < 0 || x + width > COLONY_GRID_SIZE || y < 0 || y + height > COLONY_GRID_SIZE) {
    return { valid: false, error: 'Координаты вне пределов колонии' }
  }

  let hasRequiredTerrain = !requiredTerrain || requiredTerrain.length === 0

  // Check every cell the building will occupy
  for (let bx = x; bx < x + width; bx++) {
    for (let by = y; by < y + height; by++) {
      // 2. Unlocked radius check
      const distX = Math.abs(bx - 19.5)
      const distY = Math.abs(by - 19.5)
      const maxDist = Math.max(distX, distY)
      
      if (maxDist > unlockedRadius - 0.5) {
        return { valid: false, error: 'Эта территория еще не расчищена' }
      }

      // 3. Terrain blocked check
      const cell = terrainGrid.find(c => c.x === bx && c.y === by)
      if (cell) {
        if (cell.t === 'blocked_rock') {
          return { valid: false, error: 'Нельзя строить на скалах' }
        }
        if (requiredTerrain && requiredTerrain.includes(cell.t)) {
          hasRequiredTerrain = true
        }
      }
    }
  }

  if (!hasRequiredTerrain) {
    return { valid: false, error: `Для этого здания требуется особый ландшафт: ${requiredTerrain?.join(', ')}` }
  }

  // 4. Occupied check (AABB collision)
  const isOccupied = occupiedCells.some(c => {
    return !(x >= c.x + c.width || x + width <= c.x || y >= c.y + c.height || y + height <= c.y)
  })
  if (isOccupied) {
    return { valid: false, error: 'Клетка уже занята другим зданием' }
  }

  return { valid: true }
}
