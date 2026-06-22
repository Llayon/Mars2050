import type { UnitTypeKey, UnitTypeConfig } from './combat.types'

export const UNIT_TYPES: Record<UnitTypeKey, UnitTypeConfig> = {

  drone: {
    name: 'Боевой дрон',
    hireCost: { minerals: 40, energy: 40 },
    squadSize: 3, squadSpacing: 30, baseStats: { hp: 20, attack: 15, defense: 0, speed: 6, range: 1, attackType: 'single', actionCooldownMax: 5, isFlying: true, turnSpeed: 40 }
  },
  aa_turret: {
    name: 'ПВО-Турель',
    hireCost: { minerals: 100, energy: 60 },
    baseStats: { hp: 150, attack: 40, defense: 4, speed: 0, range: 7, attackType: 'single', actionCooldownMax: 15, canTargetAir: true, turnSpeed: 1 }
  },

  marine: {
    name: 'Пехотинец',
    hireCost: { minerals: 30, energy: 60 },
    squadSize: 5, squadSpacing: 20, formation: 'line', baseStats: { hp: 40, attack: 12, defense: 2, speed: 8, range: 2, attackType: 'single', actionCooldownMax: 8, canTargetAir: true, turnSpeed: 30 }
  },
  exosuit: {
    name: 'Экзоскелет',
    hireCost: { minerals: 80, energy: 20 },
    baseStats: { hp: 120, attack: 18, defense: 8, speed: 3, range: 1, attackType: 'single', actionCooldownMax: 15, canTargetAir: true, turnSpeed: 3 }
  },
  sniper: {
    name: 'Снайпер',
    hireCost: { minerals: 40, energy: 20, water: 50 },
    squadSize: 3, squadSpacing: 25, formation: 'wedge', baseStats: { hp: 30, attack: 25, defense: 1, speed: 5, range: 5, attackType: 'single', actionCooldownMax: 25, canTargetAir: true, turnSpeed: 15 }
  },
  medic: {
    name: 'Медик',
    hireCost: { minerals: 20, energy: 10, water: 10, food: 40 },
    squadSize: 2, squadSpacing: 25, baseStats: { hp: 50, attack: 10, defense: 3, speed: 4, range: 2, attackType: 'heal', actionCooldownMax: 12, turnSpeed: 20 }
  },
  rocketeer: {
    name: 'Ракетчик',
    hireCost: { minerals: 30, energy: 30, oxygen: 50 },
    squadSize: 3, squadSpacing: 25, baseStats: { hp: 60, attack: 15, defense: 4, speed: 4, range: 3, attackType: 'aoe', aoeRadius: 1, actionCooldownMax: 20, canTargetAir: true, turnSpeed: 10 }
  },
  engineer: {
    name: 'Инженер',
    hireCost: { minerals: 50, energy: 30, research_points: 40 },
    baseStats: { hp: 60, attack: 8, defense: 4, speed: 5, range: 3, attackType: 'spawn', actionCooldownMax: 30, turnSpeed: 8 }
  },
  wall: {
    name: 'Стена',
    hireCost: { minerals: 100 },
    baseStats: { hp: 500, attack: 0, defense: 15, speed: 0, range: 0, attackType: 'single', actionCooldownMax: 10, turnSpeed: 0 }
  },
  turret: {
    name: 'Авто-турель',
    hireCost: { minerals: 150, energy: 50 },
    baseStats: { hp: 200, attack: 20, defense: 5, speed: 0, range: 6, attackType: 'single', actionCooldownMax: 5, canTargetAir: true, turnSpeed: 1.5 }
  },
  alien_bug: {
    name: 'Марсианский жук',
    hireCost: {}, // Unbuildable
    squadSize: 10, squadSpacing: 15, formation: 'grid', baseStats: { hp: 50, attack: 15, defense: 3, speed: 10, range: 1, attackType: 'single', actionCooldownMax: 5, turnSpeed: 40 }
  },
  alien_spitter: {
    name: 'Кислотный плевун',
    hireCost: {},
    squadSize: 3, squadSpacing: 25, formation: 'line', baseStats: { hp: 40, attack: 20, defense: 2, speed: 6, range: 4, attackType: 'aoe', aoeRadius: 1.5, actionCooldownMax: 12, turnSpeed: 15 }
  },
  alien_worm: {
    name: 'Песчаный червь',
    hireCost: {},
    baseStats: { hp: 250, attack: 35, defense: 8, speed: 4, range: 1, attackType: 'aoe', aoeRadius: 2, actionCooldownMax: 30, turnSpeed: 2 }
  }
}

export const GRID_WIDTH = 10
export const GRID_HEIGHT = 18
export const MAX_TICKS = 400
