import type { BuildingTypeKey, BuildingType } from './building.types'

/** Building definitions: cost, production, consumption per type. */
export const BUILDING_TYPES: Record<BuildingTypeKey, BuildingType> = {
  solar_panels: { name: 'Солнечные панели', cost: { minerals: 80, energy: 20 }, production: { energy: 15 }, consumption: {}, description: 'Генерирует энергию из солнечного света', width: 1, height: 1, workforce: { tier: 'worker', count: 1 } },
  oxygen_generator: { name: 'Кислородный генератор', cost: { minerals: 100, energy: 50 }, production: { oxygen: 10 }, consumption: { energy: 5 }, description: 'Производит кислород для колонии', width: 1, height: 1, workforce: { tier: 'worker', count: 1 } },
  water_extractor: { name: 'Водяной насос', cost: { minerals: 120, energy: 60 }, production: { water: 8 }, consumption: { energy: 8 }, description: 'Добывает воду из марсианских льдов', width: 1, height: 1, workforce: { tier: 'worker', count: 1 } },
  mine: { name: 'Шахта', cost: { minerals: 150, energy: 40 }, production: { minerals: 12 }, consumption: { energy: 10 }, description: 'Добывает полезные ископаемые', width: 1, height: 1, workforce: { tier: 'worker', count: 2 } },
  greenhouse: { name: 'Теплица', cost: { minerals: 100, water: 30 }, production: { food: 6 }, consumption: { water: 4, energy: 3 }, description: 'Выращивает еду для колонистов', width: 1, height: 1, workforce: { tier: 'worker', count: 2 } },
  research_lab: { name: 'Исследовательская лаборатория', cost: { minerals: 200, energy: 80 }, production: { research_points: 5 }, consumption: { energy: 15, water: 2 }, description: 'Проводит научные исследования', width: 1, height: 1, workforce: { tier: 'scientist', count: 1 }, unlockedByTier: 'scientist' },
  habitat: { name: 'Жилой модуль', cost: { minerals: 150, energy: 30, water: 20 }, production: {}, consumption: {}, description: 'Обеспечивает жильем колонистов', width: 1, height: 1, workforce: { tier: 'worker', count: 0 } },
  community_hall: { name: 'Общественный зал', cost: { minerals: 200, energy: 100 }, production: {}, consumption: { energy: 5 }, description: 'Позволяет рабочим становиться техниками', width: 2, height: 1, workforce: { tier: 'worker', count: 0 } },
  workshop: { name: 'Мастерская', cost: { minerals: 250, energy: 150 }, production: { consumer_goods: 4 }, consumption: { minerals: 3, energy: 8 }, description: 'Производит товары первой необходимости', width: 1, height: 1, workforce: { tier: 'worker', count: 2 }, unlockedByTier: 'technician' },
  advanced_mine: { name: 'Глубинная шахта', cost: { minerals: 400, energy: 200, consumer_goods: 10 }, production: { minerals: 20, rare_metals: 3 }, consumption: { energy: 20 }, description: 'Добывает редкие металлы', width: 2, height: 2, workforce: { tier: 'technician', count: 2 }, requiresTerrain: ['iron_deposit'], unlockedByTier: 'technician' },
  geothermal_plant: { name: 'Геотермальная станция', cost: { minerals: 300, rare_metals: 5 }, production: { energy: 40 }, consumption: {}, description: 'Использует тепло Марса', width: 2, height: 2, workforce: { tier: 'technician', count: 1 }, requiresTerrain: ['geothermal'], unlockedByTier: 'technician' },
  vehicle_bay: { name: 'Сборочный цех', cost: { minerals: 500, energy: 200 }, production: {}, consumption: { energy: 20 }, description: 'Производит технику', width: 2, height: 2, workforce: { tier: 'technician', count: 3 }, unlockedByTier: 'technician' },
  habitat_mk2: { name: 'Улучшенный жилой модуль', cost: { minerals: 300, energy: 50, water: 40 }, production: {}, consumption: {}, description: 'Жилье для техников', width: 1, height: 1, workforce: { tier: 'technician', count: 0 }, unlockedByTier: 'technician' },
  biotech_lab: { name: 'Биотех-лаборатория', cost: { minerals: 400, rare_metals: 10 }, production: { research_points: 10 }, consumption: { energy: 30, water: 10 }, description: 'Продвинутые исследования', width: 2, height: 2, workforce: { tier: 'scientist', count: 2 }, unlockedByTier: 'scientist' },
  data_center: { name: 'Дата-центр', cost: { minerals: 300, rare_metals: 10, consumer_goods: 20 }, production: { databanks: 4 }, consumption: { energy: 25 }, description: 'Обрабатывает данные', width: 1, height: 1, workforce: { tier: 'technician', count: 2 }, unlockedByTier: 'scientist' },
  nanoforge: { name: 'Нанокузница', cost: { minerals: 500, rare_metals: 20, databanks: 10 }, production: { nanomaterials: 2 }, consumption: { rare_metals: 1, energy: 30 }, description: 'Производит наноматериалы', width: 2, height: 2, workforce: { tier: 'scientist', count: 2 }, unlockedByTier: 'scientist' },
  university: { name: 'Университет', cost: { minerals: 800, energy: 400, databanks: 20 }, production: {}, consumption: { energy: 40 }, description: 'Обучение техников', width: 3, height: 2, workforce: { tier: 'scientist', count: 1 }, unlockedByTier: 'scientist' },
  habitat_mk3: { name: 'Жилой комплекс', cost: { minerals: 600, energy: 100, water: 80, consumer_goods: 20 }, production: {}, consumption: {}, description: 'Жилье для учёных', width: 2, height: 2, workforce: { tier: 'scientist', count: 0 }, unlockedByTier: 'scientist' },
  hq: { name: 'Штаб-квартира', cost: { minerals: 2000, nanomaterials: 50 }, production: {}, consumption: { energy: 100 }, description: 'Центр управления', width: 3, height: 3, workforce: { tier: 'director', count: 2 }, unlockedByTier: 'director' },
  spaceport: { name: 'Космопорт', cost: { minerals: 3000, nanomaterials: 100 }, production: {}, consumption: { energy: 200 }, description: 'Торговля и логистика', width: 4, height: 4, workforce: { tier: 'director', count: 5 }, unlockedByTier: 'director' },
  military_academy: { name: 'Военная академия', cost: { minerals: 1500, nanomaterials: 30 }, production: {}, consumption: { energy: 80 }, description: 'Подготовка офицеров', width: 3, height: 3, workforce: { tier: 'director', count: 3 }, unlockedByTier: 'director' },
  executive_dome: { name: 'Элитный купол', cost: { minerals: 1000, nanomaterials: 10, consumer_goods: 50 }, production: {}, consumption: {}, description: 'Жилье для элиты', width: 2, height: 2, workforce: { tier: 'director', count: 0 }, unlockedByTier: 'director' }
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