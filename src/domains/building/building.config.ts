import type { BuildingTypeKey, BuildingType } from './building.types'

/** Building definitions: cost, production, consumption per type. */
export const BUILDING_TYPES: Record<BuildingTypeKey, BuildingType> = {
  solar_panels: {
    name: 'Солнечные панели', cost: { minerals: 80, energy: 20 },
    production: { energy: 15 }, consumption: {},
    description: 'Генерирует энергию из солнечного света',
    width: 1, height: 1
  },
  oxygen_generator: {
    name: 'Кислородный генератор', cost: { minerals: 100, energy: 50 },
    production: { oxygen: 10 }, consumption: { energy: 5 },
    description: 'Производит кислород для колонии',
    width: 1, height: 1
  },
  water_extractor: {
    name: 'Водяной насос', cost: { minerals: 120, energy: 60 },
    production: { water: 8 }, consumption: { energy: 8 },
    description: 'Добывает воду из марсианских льдов',
    width: 2, height: 2
  },
  mine: {
    name: 'Шахта', cost: { minerals: 150, energy: 40 },
    production: { minerals: 12 }, consumption: { energy: 10 },
    description: 'Добывает полезные ископаемые',
    width: 1, height: 1
  },
  greenhouse: {
    name: 'Теплица', cost: { minerals: 100, water: 30 },
    production: { food: 6 }, consumption: { water: 4, energy: 3 },
    description: 'Выращивает еду для колонистов',
    width: 1, height: 1
  },
  research_lab: {
    name: 'Исследовательская лаборатория', cost: { minerals: 200, energy: 80 },
    production: { research_points: 5 }, consumption: { energy: 15, water: 2 },
    description: 'Проводит научные исследования',
    width: 1, height: 1
  }
}

/** Maps building type to the resource it produces. */
export const BUILDING_RESOURCE_MAP: Record<BuildingTypeKey, string> = {
  solar_panels: 'energy',
  oxygen_generator: 'oxygen',
  water_extractor: 'water',
  mine: 'minerals',
  greenhouse: 'food',
  research_lab: 'research_points'
}

/** Maps building type to its production rate. */
export const BUILDING_PRODUCTION_MAP: Record<BuildingTypeKey, number> = {
  solar_panels: 15,
  oxygen_generator: 10,
  water_extractor: 8,
  mine: 12,
  greenhouse: 6,
  research_lab: 5
}

/** Maps building type to its consumption rate per resource. */
export const BUILDING_CONSUMPTION_MAP: Record<BuildingTypeKey, Record<string, number>> = {
  solar_panels: {},
  oxygen_generator: { energy: 5 },
  water_extractor: { energy: 8 },
  mine: { energy: 10 },
  greenhouse: { water: 4, energy: 3 },
  research_lab: { energy: 15, water: 2 }
}

/** Starting resources for a new colony. */
export const STARTING_RESOURCES: Record<string, number> = {
  oxygen: 100, water: 100, energy: 100, minerals: 100, food: 100, research_points: 100
}

/** Isometric grid settings and rendering limits for TWA performance. */
export const RENDER_LIMITS = {
  TILE_WIDTH: 64, TILE_HEIGHT: 32, MAX_SPRITES: 200,
  CANVAS_FALLBACK: true, DISABLE_FILTERS_ON_CANVAS: true, MAP_SIZE: 20,
}

/** Default position for the first building. */
export const STARTING_POSITION = { x: 10, y: 10 }