import { hashCoord } from './mars-terrain-field'
import { TERRAIN_SALTS } from './mars-terrain-biomes'

/**
 * Deterministic geological flow vector for a region on Mars.
 */
export interface RegionFlowVector {
  angleDeg: number
  angleRad: number
  strength: number
  dirX: number
  dirY: number
}

/**
 * Full flow field descriptor for the map instance.
 */
export interface TerrainFlowField {
  globalAngleDeg: number
  globalAngleRad: number
  globalDirX: number
  globalDirY: number
  regionFlows: Map<number, RegionFlowVector>
}

/**
 * Generates a deterministic geological flow field for the terrain.
 */
export function generateTerrainFlowField(
  seed: number,
  regions: readonly { id: number; centerX: number; centerY: number }[]
): TerrainFlowField {
  // Global planetary atmospheric wind angle (25..45 deg)
  const globalAngleHash = hashCoord(seed, 42, 42, TERRAIN_SALTS.BIOME)
  const globalAngleDeg = 25 + ((globalAngleHash % 2000) / 2000) * 20
  const globalAngleRad = (globalAngleDeg * Math.PI) / 180
  const globalDirX = Math.cos(globalAngleRad)
  const globalDirY = Math.sin(globalAngleRad)

  const regionFlows = new Map<number, RegionFlowVector>()

  for (const reg of regions) {
    const regAngleHash = hashCoord(seed, reg.centerX, reg.centerY, TERRAIN_SALTS.REGION)
    const angleDelta = (((regAngleHash % 1000) - 500) / 1000) * 20 // +/- 10 degrees perturbation
    const regAngleDeg = globalAngleDeg + angleDelta
    const regAngleRad = (regAngleDeg * Math.PI) / 180
    const strengthHash = hashCoord(seed, reg.centerX + 3, reg.centerY + 5, TERRAIN_SALTS.ELEVATION)
    const strength = 0.6 + ((strengthHash % 400) / 1000) // 0.6 .. 1.0

    regionFlows.set(reg.id, {
      angleDeg: regAngleDeg,
      angleRad: regAngleRad,
      strength,
      dirX: Math.cos(regAngleRad),
      dirY: Math.sin(regAngleRad)
    })
  }

  return {
    globalAngleDeg,
    globalAngleRad,
    globalDirX,
    globalDirY,
    regionFlows
  }
}
