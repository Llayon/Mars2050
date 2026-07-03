import { BUILDING_TYPES } from '@/domains/building/building.config'
import { getEffectiveProduction } from '@/domains/building/building.production'
import { allocateBuildingStaffing } from '@/domains/building/building.staffing'
import type { BuildingRow } from '@/domains/building/building.types'
import { calculateArmyUpkeep } from '@/domains/combat/combat.upkeep'
import { calculateNeedsSatisfaction, calculateTierHappiness } from '@/domains/population/population.growth'
import type { PopulationState, PopulationTier, TierNeed } from '@/domains/population/population.types'
import { POPULATION_TIERS } from '@/domains/population/population.config'
import { getReservedWorkOrderSlots } from '@/domains/work-order/work-order.service'
import type { WorkOrderRow } from '@/domains/work-order/work-order.types'
import { getServerClient } from './resource.server'
import type { ResourceRow, ResourceTypeKey } from './resource.types'
import { applyInputScarcity, type BuildingRateInput, type ResourceRateMap } from './resource.economy'
import { buildEconomyCrisisRecommendations, type EconomyCrisisRecommendation } from './resource.crisis'

export interface EconomyDebugBreakdown {
  elapsedHours: number
  production: ResourceRateMap
  consumption: ResourceRateMap
  net: ResourceRateMap
  storage: ResourceStorageBreakdown[]
  buildings: ReturnType<typeof applyInputScarcity>['buildings']
  scarcity: ReturnType<typeof applyInputScarcity>['scarcity']
  populationConsumption: ResourceRateMap
  populationNeeds: PopulationNeedsBreakdown[]
  recommendations: EconomyCrisisRecommendation[]
  armyUpkeep: ResourceRateMap
  reservedWorkOrderSlots: Partial<Record<PopulationTier, number>>
}

export interface ResourceStorageBreakdown {
  type: ResourceTypeKey
  amount: number
  capacity: number
  fillRatio: number
  remaining: number
}

export interface PopulationNeedRow extends TierNeed {
  required: number
  available: number
  satisfaction: number
}

export interface PopulationNeedsBreakdown {
  tier: PopulationTier
  population: number
  housingCapacity: number
  happiness: number
  satisfaction: {
    basic: number
    comfort: number
    luxury: number
  }
  needs: PopulationNeedRow[]
}

function addRate(target: ResourceRateMap, source: ResourceRateMap) {
  for (const [type, value] of Object.entries(source)) {
    const resourceType = type as ResourceTypeKey
    target[resourceType] = (target[resourceType] || 0) + (value || 0)
  }
}

function addPopulationConsumption(population: PopulationState | null): ResourceRateMap {
  const consumption: ResourceRateMap = {}
  if (!population) return consumption

  const tiers: PopulationTier[] = ['worker', 'technician', 'scientist', 'director']
  for (const tier of tiers) {
    const count = population[`${tier}s` as keyof PopulationState] as number
    if (count <= 0) continue
    for (const need of POPULATION_TIERS[tier].needs) {
      consumption[need.resource] = (consumption[need.resource] || 0) + need.amountPer10 * (count / 10)
    }
  }

  return consumption
}

function getResourceAmount(resources: ResourceRow[], type: ResourceTypeKey): number {
  return resources.find(resource => resource.type === type)?.amount || 0
}

function buildNeedRows(needs: TierNeed[], population: number, resources: ResourceRow[]): PopulationNeedRow[] {
  return needs.map(need => {
    const required = need.amountPer10 * (population / 10)
    const available = getResourceAmount(resources, need.resource)
    const satisfaction = required <= 0 ? 1 : Math.min(available / required, 1)
    return { ...need, required, available, satisfaction }
  })
}

function buildPopulationNeedsBreakdown(
  population: PopulationState | null,
  resources: ResourceRow[],
  housingCapacity: Record<PopulationTier, number>,
): PopulationNeedsBreakdown[] {
  if (!population) return []

  return (['worker', 'technician', 'scientist', 'director'] as PopulationTier[]).map(tier => {
    const config = POPULATION_TIERS[tier]
    const count = population[`${tier}s` as keyof PopulationState] as number
    const needs = buildNeedRows(config.needs, count, resources)
    const basicNeeds = config.needs.filter(need => need.category === 'basic')
    const comfortNeeds = config.needs.filter(need => need.category === 'comfort')
    const luxuryNeeds = config.needs.filter(need => need.category === 'luxury')

    return {
      tier,
      population: count,
      housingCapacity: housingCapacity[tier],
      happiness: calculateTierHappiness(tier, count, resources, housingCapacity[tier]),
      satisfaction: {
        basic: calculateNeedsSatisfaction(basicNeeds, count, resources),
        comfort: calculateNeedsSatisfaction(comfortNeeds, count, resources),
        luxury: calculateNeedsSatisfaction(luxuryNeeds, count, resources),
      },
      needs,
    }
  })
}

function buildStorageBreakdown(resources: ResourceRow[]): ResourceStorageBreakdown[] {
  return resources.map(resource => {
    const capacity = resource.capacity ?? 0
    return {
      type: resource.type,
      amount: resource.amount,
      capacity,
      fillRatio: capacity > 0 ? Math.min(resource.amount / capacity, 1) : 0,
      remaining: Math.max(0, capacity - resource.amount),
    }
  })
}

/**
 * Returns an economy QA breakdown without mutating resource amounts.
 */
export async function getEconomyDebugBreakdown(colonyId: string): Promise<EconomyDebugBreakdown | null> {
  const supabase = getServerClient()
  const [
    { data: resources, error: resError },
    { data: colony },
    { data: population },
    { data: buildings },
    { data: units },
    { data: activeWorkOrders }
  ] = await Promise.all([
    supabase.from('resources').select('*').eq('colony_id', colonyId),
    supabase.from('colonies').select('terrain_grid, last_calc_at').eq('id', colonyId).single(),
    supabase.from('population').select('*').eq('colony_id', colonyId).single(),
    supabase.from('buildings').select('*').eq('colony_id', colonyId),
    supabase.from('units').select('*').eq('colony_id', colonyId),
    supabase.from('work_orders').select('*').eq('colony_id', colonyId).eq('status', 'active')
  ])

  if (resError || !resources) return null

  const resourceRows = resources as ResourceRow[]
  const buildingRows = (buildings || []) as BuildingRow[]
  const populationState = population as PopulationState | null
  const reservedWorkOrderSlots = getReservedWorkOrderSlots((activeWorkOrders || []) as unknown as WorkOrderRow[])
  const assignments = populationState ? allocateBuildingStaffing(buildingRows, populationState, reservedWorkOrderSlots) : {}
  const elapsedHours = colony?.last_calc_at ? Math.max(0, (Date.now() - new Date(colony.last_calc_at).getTime()) / 3600000) : 0
  const terrainGrid = colony?.terrain_grid || []
  const housingCapacity = {
    worker: 0,
    technician: 0,
    scientist: 0,
    director: 0,
  }

  for (const building of buildingRows) {
    if (!building.is_active) continue
    for (const tier of ['worker', 'technician', 'scientist', 'director'] as PopulationTier[]) {
      const cap = POPULATION_TIERS[tier].housingPerBuilding[building.type] || 0
      housingCapacity[tier] += cap * (building.level || 1)
    }
  }

  const buildingInputs: BuildingRateInput[] = buildingRows.map(building => {
    const assignedBuilding = { ...building, assigned_workers: assignments[building.id] ?? building.assigned_workers }
    const { production, consumption } = getEffectiveProduction(assignedBuilding, populationState, buildingRows, terrainGrid)
    return { buildingId: building.id, buildingType: building.type, production, consumption }
  }).filter(building => BUILDING_TYPES[building.buildingType])

  const throttled = applyInputScarcity(buildingInputs, resourceRows, elapsedHours)
  const production: ResourceRateMap = {}
  const consumption: ResourceRateMap = {}

  for (const building of throttled.buildings) {
    addRate(production, building.production)
    addRate(consumption, building.consumption)
  }

  const populationConsumption = addPopulationConsumption(populationState)
  const populationNeeds = buildPopulationNeedsBreakdown(populationState, resourceRows, housingCapacity)
  const storage = buildStorageBreakdown(resourceRows)
  addRate(consumption, populationConsumption)

  const armyUpkeep = calculateArmyUpkeep(units || [])
  addRate(consumption, armyUpkeep)

  const net = resourceRows.reduce<ResourceRateMap>((acc, resource) => {
    acc[resource.type] = (production[resource.type] || 0) - (consumption[resource.type] || 0)
    return acc
  }, {})
  const recommendations = buildEconomyCrisisRecommendations({
    resources: resourceRows,
    net,
    scarcity: throttled.scarcity,
    buildings: throttled.buildings,
    populationNeeds,
    armyUpkeep,
  })

  return {
    elapsedHours,
    production,
    consumption,
    net,
    storage,
    buildings: throttled.buildings,
    scarcity: throttled.scarcity,
    populationConsumption,
    populationNeeds,
    recommendations,
    armyUpkeep,
    reservedWorkOrderSlots,
  }
}
