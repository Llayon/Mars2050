import { PopulationTier, TierConfig } from './population.types'

export const POPULATION_TIERS: Record<PopulationTier, TierConfig> = {
  worker: {
    name: 'Рабочие',
    icon: '👷',
    needs: [
      { resource: 'water', amountPer10: 3, category: 'basic' },
      { resource: 'oxygen', amountPer10: 2, category: 'basic' },
      { resource: 'food', amountPer10: 4, category: 'basic' },
    ],
    housingPerBuilding: {
      habitat: 10,
    },
    upgradeBuilding: 'community_hall',
    upgradeCost: { consumer_goods: 20, minerals: 50 },
    staffingFor: [
      'mine', 'solar_panels', 'water_extractor',
      'oxygen_generator', 'greenhouse', 'workshop',
    ],
  },
  technician: {
    name: 'Техники',
    icon: '🔧',
    needs: [
      { resource: 'water', amountPer10: 4, category: 'basic' },
      { resource: 'oxygen', amountPer10: 3, category: 'basic' },
      { resource: 'food', amountPer10: 5, category: 'basic' },
      { resource: 'consumer_goods', amountPer10: 2, category: 'comfort' },
    ],
    housingPerBuilding: {
      habitat_mk2: 6,
      habitat: 4,
    },
    upgradeBuilding: 'university',
    upgradeCost: { databanks: 25, nanomaterials: 10 },
    staffingFor: [
      'advanced_mine', 'geothermal_plant', 'vehicle_bay',
      'workshop', 'habitat_mk2', 'data_center', 'university',
    ],
  },
  scientist: {
    name: 'Учёные',
    icon: '🔬',
    needs: [
      { resource: 'water', amountPer10: 4, category: 'basic' },
      { resource: 'oxygen', amountPer10: 3, category: 'basic' },
      { resource: 'food', amountPer10: 5, category: 'basic' },
      { resource: 'consumer_goods', amountPer10: 3, category: 'comfort' },
      { resource: 'databanks', amountPer10: 2, category: 'luxury' },
    ],
    housingPerBuilding: {
      habitat_mk3: 4,
    },
    upgradeBuilding: 'hq',
    upgradeCost: { rare_metals: 10, energy: 100 },
    staffingFor: [
      'research_lab', 'biotech_lab', 'nanoforge',
    ],
  },
  director: {
    name: 'Элита',
    icon: '👔',
    needs: [
      { resource: 'water', amountPer10: 5, category: 'basic' },
      { resource: 'oxygen', amountPer10: 3, category: 'basic' },
      { resource: 'food', amountPer10: 6, category: 'basic' },
      { resource: 'consumer_goods', amountPer10: 4, category: 'comfort' },
      { resource: 'databanks', amountPer10: 3, category: 'luxury' },
      { resource: 'nanomaterials', amountPer10: 1, category: 'luxury' },
    ],
    housingPerBuilding: {
      executive_dome: 2,
    },
    upgradeBuilding: null,
    staffingFor: [
      'hq', 'spaceport', 'military_academy',
    ],
  },
}

export const GROWTH_INTERVAL_TICKS = 10

export const HAPPINESS_GROWTH_MULT: Record<number, number> = {
  90: 2.0,
  70: 1.0,
  50: 0.5,
  30: 0.0,
  10: -0.5,
}
