import type { UnitTypeKey, UnitTypeConfig } from './combat.types'

export const UNIT_TYPES: Record<UnitTypeKey, UnitTypeConfig> = {
  marine: {
    name: 'Пехотинец',
    hireCost: { minerals: 30, energy: 60 },
    baseStats: { hp: 40, attack: 12, defense: 2, speed: 8, range: 2, attackType: 'single' }
  },
  exosuit: {
    name: 'Экзоскелет',
    hireCost: { minerals: 80, energy: 20 },
    baseStats: { hp: 120, attack: 18, defense: 8, speed: 3, range: 1, attackType: 'single' }
  },
  sniper: {
    name: 'Снайпер',
    hireCost: { minerals: 40, energy: 20, water: 50 },
    baseStats: { hp: 30, attack: 25, defense: 1, speed: 5, range: 5, attackType: 'single' }
  },
  medic: {
    name: 'Медик',
    hireCost: { minerals: 20, energy: 10, water: 10, food: 40 },
    baseStats: { hp: 50, attack: 10, defense: 3, speed: 4, range: 2, attackType: 'heal' }
  },
  rocketeer: {
    name: 'Ракетчик',
    hireCost: { minerals: 30, energy: 30, oxygen: 50 },
    baseStats: { hp: 60, attack: 15, defense: 4, speed: 4, range: 3, attackType: 'aoe', aoeRadius: 1 }
  },
  engineer: {
    name: 'Инженер',
    hireCost: { minerals: 50, energy: 30, research_points: 40 },
    baseStats: { hp: 60, attack: 8, defense: 4, speed: 5, range: 3, attackType: 'single' }
  }
}
