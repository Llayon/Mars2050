import { DEFAULT_MAP_SEED } from '@/domains/map/map.config'
import type {
  TerrainBiome,
  TerrainVisualRegion,
  TerrainVisualCell,
  TerrainVisualField,
  TerrainFieldOptions
} from './mars-terrain.types'
import { TERRAIN_SALTS, BIOME_TRAITS } from './mars-terrain-biomes'

/**
 * 32-bit deterministic coordinate hash using Math.imul.
 */
export function hashCoord(seed: number, x: number, y: number, salt: number = 0): number {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ salt) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

/**
 * 32-bit deterministic 1D index hash using Math.imul.
 */
export function hash1D(seed: number, index: number, salt: number = 0): number {
  let h = (seed ^ Math.imul(index, 374761393) ^ salt) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

/**
 * Pick a biome from available traits based on deterministic hash.
 */
function pickWeightedBiome(hash: number, allowPolar: boolean): TerrainBiome {
  const entries = (Object.keys(BIOME_TRAITS) as TerrainBiome[])
    .filter(b => allowPolar || b !== 'polar')

  let totalWeight = 0
  for (const b of entries) totalWeight += BIOME_TRAITS[b].regionWeight

  let sample = (hash >>> 0) % totalWeight
  for (const b of entries) {
    sample -= BIOME_TRAITS[b].regionWeight
    if (sample < 0) return b
  }
  return entries[0]
}

/**
 * Helper to clamp values in [min, max].
 */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

/**
 * Generates deterministic macro-regions across the map grid.
 */
function generateMacroRegions(
  width: number,
  height: number,
  seed: number,
  allowPolar: boolean
): TerrainVisualRegion[] {
  const regionCount = 7 // 6..9 range
  const regions: TerrainVisualRegion[] = []

  // Divide map into soft grid zones for balanced spread with jitter
  const cols = 3
  const rows = Math.ceil(regionCount / cols)

  for (let i = 0; i < regionCount; i++) {
    const rX = i % cols
    const rY = Math.floor(i / cols)

    const baseCenterX = ((rX + 0.5) / cols) * width
    const baseCenterY = ((rY + 0.5) / rows) * height

    const jitterHashX = hash1D(seed, i * 2, TERRAIN_SALTS.REGION)
    const jitterHashY = hash1D(seed, i * 2 + 1, TERRAIN_SALTS.REGION)
    const scaleHash = hash1D(seed, i, TERRAIN_SALTS.BIOME)

    // Jitter within [-0.25..0.25] cell span of the zone
    const jitterX = ((jitterHashX % 1000) / 1000 - 0.5) * (width / cols) * 0.8
    const jitterY = ((jitterHashY % 1000) / 1000 - 0.5) * (height / rows) * 0.8

    const centerX = clamp(baseCenterX + jitterX, 1.5, width - 1.5)
    const centerY = clamp(baseCenterY + jitterY, 1.5, height - 1.5)

    const scaleX = 0.75 + ((scaleHash % 600) / 1000) // 0.75 .. 1.35
    const scaleY = 0.75 + (((scaleHash >> 10) % 600) / 1000)
    const influence = 0.85 + (((scaleHash >> 20) % 300) / 1000) // 0.85 .. 1.15

    const biomeHash = hash1D(seed, i, TERRAIN_SALTS.BIOME)
    const biome = pickWeightedBiome(biomeHash, allowPolar)

    regions.push({
      id: i,
      biome,
      centerX,
      centerY,
      scaleX,
      scaleY,
      influence,
      seed: (seed + i * 1337) >>> 0
    })
  }

  return regions
}

/**
 * Deterministically generates the full TerrainVisualField from config and seed.
 * Pure function: same input always produces identical output.
 */
export function generateTerrainVisualField(
  options: TerrainFieldOptions
): TerrainVisualField {
  const width = options.width
  const height = options.height
  const seed = options.seed ?? DEFAULT_MAP_SEED
  const allowPolar = options.allowPolar ?? false

  const regions = generateMacroRegions(width, height, seed, allowPolar)
  const cells: TerrainVisualCell[] = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let bestDist = Infinity
      let bestRegion = regions[0]
      let secondDist = Infinity
      let secondRegion = regions[0]

      // Evaluate anisotropic Euclidean distance to all region centers
      for (const reg of regions) {
        const dx = (x - reg.centerX) / reg.scaleX
        const dy = (y - reg.centerY) / reg.scaleY
        const dist = Math.sqrt(dx * dx + dy * dy) / reg.influence

        if (dist < bestDist) {
          secondDist = bestDist
          secondRegion = bestRegion
          bestDist = dist
          bestRegion = reg
        } else if (dist < secondDist) {
          secondDist = dist
          secondRegion = reg
        }
      }

      const primaryTrait = BIOME_TRAITS[bestRegion.biome]
      const secondaryTrait = BIOME_TRAITS[secondRegion.biome]

      // Soft blending weight based on boundary proximity
      const blendFactor = clamp((secondDist - bestDist) / 1.2, 0, 1)

      const baseElevation = primaryTrait.baseElevation * blendFactor +
        secondaryTrait.baseElevation * (1 - blendFactor)
      const baseRoughness = primaryTrait.baseRoughness * blendFactor +
        secondaryTrait.baseRoughness * (1 - blendFactor)
      const baseDust = primaryTrait.baseDust * blendFactor +
        secondaryTrait.baseDust * (1 - blendFactor)

      // Low-amplitude smooth spatial variance
      const elevMod = ((hashCoord(seed, x, y, TERRAIN_SALTS.ELEVATION) % 200) - 100) / 1000
      const roughMod = ((hashCoord(seed, x, y, TERRAIN_SALTS.ROUGHNESS) % 200) - 100) / 1000
      const dustMod = ((hashCoord(seed, x, y, TERRAIN_SALTS.DUST) % 200) - 100) / 1000

      cells.push({
        x,
        y,
        biome: bestRegion.biome,
        regionId: bestRegion.id,
        elevation: clamp(baseElevation + elevMod, 0, 1),
        roughness: clamp(baseRoughness + roughMod, 0, 1),
        dust: clamp(baseDust + dustMod, 0, 1)
      })
    }
  }

  return {
    width,
    height,
    seed,
    regions,
    cells
  }
}

/**
 * Fast lookup for cell at coordinate (x, y).
 */
export function getTerrainVisualCell(
  field: TerrainVisualField,
  x: number,
  y: number
): TerrainVisualCell | null {
  if (x < 0 || x >= field.width || y < 0 || y >= field.height) return null
  return field.cells[y * field.width + x] ?? null
}

/**
 * Key formatter for cell coordinate.
 */
export function terrainCellKey(x: number, y: number): string {
  return `${x},${y}`
}
