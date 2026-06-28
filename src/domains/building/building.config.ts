import type { BuildingTypeKey, BuildingType } from './building.types'

/** Building definitions: cost, production, consumption per type. */
export const BUILDING_TYPES: Record<BuildingTypeKey, BuildingType> = {
  solar_panels: {
    name: 'Солнечные панели', cost: { minerals: 80, energy: 20 },
    production: { energy: 15 }, consumption: {},
    description: 'Генерирует энергию из солнечного света',
    width: 1, height: 1,
    workforce: { tier: 'worker', count: 1 }
  },
  oxygen_generator: {
    name: 'Кислородный генератор', cost: { minerals: 100, energy: 50 },
    production: { oxygen: 10 }, consumption: { energy: 5 },
    description: 'Производит кислород для колонии',
    width: 1, height: 1,
    workforce: { tier: 'worker', count: 1 }
  },
  water_extractor: {
    name: 'Водяной насос', cost: { minerals: 120, energy: 60 },
    production: { water: 8 }, consumption: { energy: 8 },
    description: 'Добывает воду из марсианских льдов',
    width: 1, height: 1,
    workforce: { tier: 'worker', count: 1 }
  },
  mine: {
    name: 'Шахта', cost: { minerals: 150, energy: 40 },
    production: { minerals: 12 }, consumption: { energy: 10 },
    description: 'Добывает полезные ископаемые',
    width: 1, height: 1,
    workforce: { tier: 'worker', count: 2 }
  },
  greenhouse: {
    name: 'Теплица', cost: { minerals: 100, water: 30 },
    production: { food: 6 }, consumption: { water: 4, energy: 3 },
    description: 'Выращивает еду для колонистов',
    width: 1, height: 1,
    workforce: { tier: 'worker', count: 2 }
  },
  research_lab: {
    name: 'Исследовательская лаборатория', cost: { minerals: 200, energy: 80 },
    production: { research_points: 5 }, consumption: { energy: 15, water: 2 },
    description: 'Проводит научные исследования',
    width: 1, height: 1,
    workforce: { tier: 'scientist', count: 1 },
    unlockedByTier: 'scientist'
  },
  habitat: {
    name: 'Жилой модуль', cost: { minerals: 150, energy: 30, water: 20 },
    production: {}, consumption: {}, // Habitat doesn't consume directly, population does
    description: 'Обеспечивает жильем колонистов',
    width: 1, height: 1,
    workforce: { tier: 'worker', count: 0 }
  }
}

/** Maps building type to the resource it produces. */
export const BUILDING_RESOURCE_MAP: Record<BuildingTypeKey, string> = {
  solar_panels: 'energy',
  oxygen_generator: 'oxygen',
  water_extractor: 'water',
  mine: 'minerals',
  greenhouse: 'food',
  research_lab: 'research_points',
  habitat: ''
}
/** Maps building type to its production rate. */
export const BUILDING_PRODUCTION_MAP: Record<BuildingTypeKey, number> = {
  solar_panels: 15, oxygen_generator: 10, water_extractor: 8,
  mine: 12, greenhouse: 6, research_lab: 5, habitat: 0
}
/** Maps building type to its consumption rate per resource. */
export const BUILDING_CONSUMPTION_MAP: Record<BuildingTypeKey, Record<string, number>> = {
  solar_panels: {}, oxygen_generator: { energy: 5 }, water_extractor: { energy: 8 },
  mine: { energy: 10 }, greenhouse: { water: 4, energy: 3 }, research_lab: { energy: 15, water: 2 },
  habitat: {}
}
/** Starting resources for a new colony. */
export const STARTING_RESOURCES: Record<string, number> = {
  oxygen: 5000, water: 5000, energy: 5000, minerals: 5000, food: 5000, research_points: 5000,
  consumer_goods: 0, rare_metals: 0, databanks: 0, nanomaterials: 0
}
export const RENDER_LIMITS = {
  TILE_WIDTH: 64, TILE_HEIGHT: 32, MAX_SPRITES: 200,
  CANVAS_FALLBACK: true, DISABLE_FILTERS_ON_CANVAS: true, MAP_SIZE: 20,
}
export const STARTING_POSITION = { x: 10, y: 10 }