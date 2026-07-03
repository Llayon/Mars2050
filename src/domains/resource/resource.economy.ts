import type { BuildingTypeKey } from '@/domains/building/building.types'
import type { ResourceRow, ResourceTypeKey } from './resource.types'

export type ResourceRateMap = Partial<Record<ResourceTypeKey, number>>

export interface BuildingRateInput {
  buildingId: string
  buildingType: BuildingTypeKey
  production: ResourceRateMap
  consumption: ResourceRateMap
}

export interface BuildingRateBreakdown extends BuildingRateInput {
  inputThrottle: number
  throttleReasons: Partial<Record<ResourceTypeKey, number>>
}

export interface ScarcityResourceBreakdown {
  stock: number
  productionRate: number
  demandRate: number
  windowHours: number
  availableAmount: number
  demandedAmount: number
  factor: number
}

export interface ScarcityCalculation {
  buildings: BuildingRateBreakdown[]
  scarcity: Partial<Record<ResourceTypeKey, ScarcityResourceBreakdown>>
}

function addRate(target: ResourceRateMap, source: ResourceRateMap) {
  for (const [type, value] of Object.entries(source)) {
    const resourceType = type as ResourceTypeKey
    target[resourceType] = (target[resourceType] || 0) + (value || 0)
  }
}

function scaleRates(source: ResourceRateMap, factor: number): ResourceRateMap {
  return Object.entries(source).reduce<ResourceRateMap>((scaled, [type, value]) => {
    scaled[type as ResourceTypeKey] = (value || 0) * factor
    return scaled
  }, {})
}

/**
 * Applies aggregate input scarcity to building production and consumption.
 */
export function applyInputScarcity(
  buildingRates: BuildingRateInput[],
  resources: ResourceRow[],
  elapsedHours: number
): ScarcityCalculation {
  const windowHours = Math.max(elapsedHours, 1 / 60)
  const stockByResource = resources.reduce<Partial<Record<ResourceTypeKey, number>>>((acc, resource) => {
    acc[resource.type] = resource.amount
    return acc
  }, {})
  const buildingProduction: ResourceRateMap = {}
  const buildingDemand: ResourceRateMap = {}

  for (const building of buildingRates) {
    addRate(buildingProduction, building.production)
    addRate(buildingDemand, building.consumption)
  }

  const scarcity = Object.entries(buildingDemand).reduce<Partial<Record<ResourceTypeKey, ScarcityResourceBreakdown>>>((acc, [type, demandRate]) => {
    const resourceType = type as ResourceTypeKey
    const demand = demandRate || 0
    if (demand <= 0) return acc

    const stock = stockByResource[resourceType] || 0
    const productionRate = buildingProduction[resourceType] || 0
    const availableAmount = stock + productionRate * windowHours
    const demandedAmount = demand * windowHours
    const factor = demandedAmount <= 0 ? 1 : Math.max(0, Math.min(1, availableAmount / demandedAmount))

    acc[resourceType] = {
      stock,
      productionRate,
      demandRate: demand,
      windowHours,
      availableAmount,
      demandedAmount,
      factor,
    }
    return acc
  }, {})

  const buildings = buildingRates.map(building => {
    const reasons: Partial<Record<ResourceTypeKey, number>> = {}
    let inputThrottle = 1

    for (const type of Object.keys(building.consumption) as ResourceTypeKey[]) {
      const factor = scarcity[type]?.factor ?? 1
      if (factor < inputThrottle) inputThrottle = factor
      if (factor < 0.999) reasons[type] = factor
    }

    return {
      ...building,
      production: scaleRates(building.production, inputThrottle),
      consumption: scaleRates(building.consumption, inputThrottle),
      inputThrottle,
      throttleReasons: reasons,
    }
  })

  return { buildings, scarcity }
}
