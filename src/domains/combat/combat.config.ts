import type { UnitTypeKey, UnitTypeConfig } from './combat.types'

export const UNIT_TYPES: Record<UnitTypeKey, UnitTypeConfig> = {
  marine: {
    name: 'Пехотинец',
    hireCost: { minerals: 30, energy: 60 },
    baseStats: { hp: 40, attack: 12, defense: 2, speed: 8, range: 2, attackType: 'single', actionCooldownMax: 8 }
  },
  exosuit: {
    name: 'Экзоскелет',
    hireCost: { minerals: 80, energy: 20 },
    baseStats: { hp: 120, attack: 18, defense: 8, speed: 3, range: 1, attackType: 'single', actionCooldownMax: 15 }
  },
  sniper: {
    name: 'Снайпер',
    hireCost: { minerals: 40, energy: 20, water: 50 },
    baseStats: { hp: 30, attack: 25, defense: 1, speed: 5, range: 5, attackType: 'single', actionCooldownMax: 25 }
  },
  medic: {
    name: 'Медик',
    hireCost: { minerals: 20, energy: 10, water: 10, food: 40 },
    baseStats: { hp: 50, attack: 10, defense: 3, speed: 4, range: 2, attackType: 'heal', actionCooldownMax: 12 }
  },
  rocketeer: {
    name: 'Ракетчик',
    hireCost: { minerals: 30, energy: 30, oxygen: 50 },
    baseStats: { hp: 60, attack: 15, defense: 4, speed: 4, range: 3, attackType: 'aoe', aoeRadius: 1, actionCooldownMax: 20 }
  },
  engineer: {
    name: 'Инженер',
    hireCost: { minerals: 50, energy: 30, research_points: 40 },
    baseStats: { hp: 60, attack: 8, defense: 4, speed: 5, range: 3, attackType: 'spawn', actionCooldownMax: 30 }
  },
  wall: {
    name: 'Стена',
    hireCost: { minerals: 100 },
    baseStats: { hp: 500, attack: 0, defense: 15, speed: 0, range: 0, attackType: 'single', actionCooldownMax: 10 }
  },
  turret: {
    name: 'Авто-турель',
    hireCost: { minerals: 150, energy: 50 },
    baseStats: { hp: 200, attack: 20, defense: 5, speed: 0, range: 6, attackType: 'single', actionCooldownMax: 5 }
  },
  alien_bug: {
    name: 'Марсианский жук',
    hireCost: {}, // Unbuildable
    baseStats: { hp: 50, attack: 15, defense: 3, speed: 10, range: 1, attackType: 'single', actionCooldownMax: 5 }
  },
  alien_spitter: {
    name: 'Кислотный плевун',
    hireCost: {},
    baseStats: { hp: 40, attack: 20, defense: 2, speed: 6, range: 4, attackType: 'single', actionCooldownMax: 12 }
  },
  alien_worm: {
    name: 'Песчаный червь',
    hireCost: {},
    baseStats: { hp: 250, attack: 35, defense: 8, speed: 4, range: 1, attackType: 'aoe', aoeRadius: 2, actionCooldownMax: 30 }
  }
}

export const GRID_WIDTH = 10
export const GRID_HEIGHT = 18
export const MAX_TICKS = 400
