import type { MapLocationType, MapLocation } from './map.types'
import { DEFAULT_MAP_SEED } from './map.config'

/** Configuration options for generating a Mars map grid. */
export interface MapConfig {
  width: number
  height: number
  locationsCount: number
  seed: number
}

const LOCATION_NAMES: Record<MapLocationType, string[]> = {
  plains: ['Равнина Хриса', 'Равнина Эллада', 'Равнина Амазония', 'Равнина Аргира', 'Долина Маринер'],
  mountains: ['Горы Олимп', 'Горы Аскрий', 'Горы Павонис', 'Горы Арсия', 'Горы Элизий'],
  canyon: ['Каньон Вальес Маринерис', 'Каньон Иус', 'Каньон Титан', 'Каньон Меллас', 'Каньон Копрат'],
  crater: ['Кратер Гейл', 'Кратер Индевор', 'Кратер Брэдбери', 'Кратер Меридиани', 'Кратер Хэлл'],
  ice_cap: ['Северная полярная шапка', 'Южная полярная шапка', 'Ледник Арктический', 'Ледник Антарктический', 'Зона вечной мерзлоты']
}

const RESOURCE_MULTIPLIERS: Record<MapLocationType, Record<string, number>> = {
  plains: { oxygen: 1, water: 0.5, energy: 1, minerals: 0.8, food: 1.2, research_points: 0.5 },
  mountains: { oxygen: 0.8, water: 0.3, energy: 1.2, minerals: 1.5, food: 0.5, research_points: 0.8 },
  canyon: { oxygen: 0.6, water: 0.4, energy: 0.9, minerals: 1.2, food: 0.3, research_points: 1.5 },
  crater: { oxygen: 0.9, water: 0.6, energy: 1, minerals: 1.8, food: 0.7, research_points: 1 },
  ice_cap: { oxygen: 0.5, water: 2, energy: 0.7, minerals: 0.5, food: 0.3, research_points: 1.2 }
}

const LOCATION_TYPES: MapLocationType[] = ['plains', 'mountains', 'canyon', 'crater', 'ice_cap']

/**
 * Creates a deterministic 32-bit PRNG (Mulberry32).
 * @param seed - 32-bit integer seed
 * @returns PRNG function returning float in [0, 1)
 */
function createMulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Generate a deterministic Mars map with locations from a seed.
 * @param config - Map configuration (width, height, location count, seed)
 * @returns Array of map locations without DB IDs
 */
export function generateMarsMap(config: MapConfig): Omit<MapLocation, 'id'>[] {
  const rand = createMulberry32(config.seed)
  const locations: Omit<MapLocation, 'id'>[] = []
  const usedPositions = new Set<string>()
  const maxPossible = config.width * config.height
  const targetCount = Math.min(config.locationsCount, maxPossible)

  for (let i = 0; i < targetCount; i++) {
    let x: number, y: number
    do {
      x = Math.floor(rand() * config.width)
      y = Math.floor(rand() * config.height)
    } while (usedPositions.has(`${x},${y}`))

    usedPositions.add(`${x},${y}`)

    const type = LOCATION_TYPES[Math.floor(rand() * LOCATION_TYPES.length)]
    const names = LOCATION_NAMES[type]
    const name = names[Math.floor(rand() * names.length)]
    const difficulty = (Math.floor(rand() * 5) + 1) as MapLocation['difficulty']
    const multipliers = RESOURCE_MULTIPLIERS[type]
    const resources: Record<string, number> = {}

    for (const [resource, multiplier] of Object.entries(multipliers)) {
      resources[resource] = Math.floor(rand() * 100 * multiplier) + 10
    }

    // 25% chance to have an alien nest (determined strictly at generation time)
    if (rand() < 0.25) {
      resources['_alien_nest'] = 1
      resources['_cleared'] = 0
    }

    locations.push({
      name,
      type,
      x,
      y,
      difficulty,
      resources,
      is_discovered: false,
      created_at: new Date(1735689600000).toISOString()
    })
  }

  return locations
}

/**
 * Get default map configuration (20x20 grid, 50 locations, canonical seed).
 * @returns Default MapConfig with DEFAULT_MAP_SEED
 */
export function getDefaultMapConfig(): MapConfig {
  return {
    width: 20,
    height: 20,
    locationsCount: 50,
    seed: DEFAULT_MAP_SEED
  }
}