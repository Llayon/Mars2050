import type { MapLocationType, MapLocation } from './map.types'

interface MapConfig {
  width: number
  height: number
  locationsCount: number
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
 * Generate a random Mars map with locations.
 * @param config - Map configuration (width, height, location count)
 * @returns Array of map locations without DB IDs
 */
export function generateMarsMap(config: MapConfig): Omit<MapLocation, 'id'>[] {
  const locations: Omit<MapLocation, 'id'>[] = []
  const usedPositions = new Set<string>()

  for (let i = 0; i < config.locationsCount; i++) {
    let x: number, y: number
    do {
      x = Math.floor(Math.random() * config.width)
      y = Math.floor(Math.random() * config.height)
    } while (usedPositions.has(`${x},${y}`))

    usedPositions.add(`${x},${y}`)

    const type = LOCATION_TYPES[Math.floor(Math.random() * LOCATION_TYPES.length)]
    const names = LOCATION_NAMES[type]
    const name = names[Math.floor(Math.random() * names.length)]
    const difficulty = (Math.floor(Math.random() * 5) + 1) as MapLocation['difficulty']
    const multipliers = RESOURCE_MULTIPLIERS[type]
    const resources: Record<string, number> = {}

    for (const [resource, multiplier] of Object.entries(multipliers)) {
      resources[resource] = Math.floor(Math.random() * 100 * multiplier) + 10
    }

    locations.push({
      name,
      type,
      x,
      y,
      difficulty,
      resources,
      is_discovered: false,
      created_at: new Date().toISOString()
    })
  }

  return locations
}

/**
 * Get default map configuration (20x20 grid, 50 locations).
 * @returns Default MapConfig
 */
export function getDefaultMapConfig(): MapConfig {
  return {
    width: 20,
    height: 20,
    locationsCount: 50
  }
}