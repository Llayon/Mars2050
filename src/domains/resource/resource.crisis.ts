import type { PopulationTier, TierNeed } from '@/domains/population/population.types'
import type { ResourceRow, ResourceTypeKey } from './resource.types'
import { RESOURCE_NAMES } from './resource.types'
import type { BuildingRateBreakdown, ResourceRateMap, ScarcityCalculation } from './resource.economy'

export type EconomyCrisisSeverity = 'critical' | 'warning' | 'info'

export type EconomyCrisisCode =
  | 'basic_need_shortage'
  | 'comfort_need_shortage'
  | 'low_happiness'
  | 'overcrowding'
  | 'input_scarcity'
  | 'resource_depletion'
  | 'army_upkeep_pressure'
  | 'storage_full'

export interface CrisisNeed extends TierNeed {
  required: number
  available: number
  satisfaction: number
}

export interface CrisisPopulationTier {
  tier: PopulationTier
  population: number
  housingCapacity: number
  happiness: number
  satisfaction: Record<'basic' | 'comfort' | 'luxury', number>
  needs: CrisisNeed[]
}

export interface EconomyCrisisRecommendation {
  id: string
  code: EconomyCrisisCode
  severity: EconomyCrisisSeverity
  title: string
  detail: string
  priority: number
  resource?: ResourceTypeKey
  tier?: PopulationTier
}

interface CrisisInput {
  resources: ResourceRow[]
  net: ResourceRateMap
  scarcity: ScarcityCalculation['scarcity']
  buildings: BuildingRateBreakdown[]
  populationNeeds: CrisisPopulationTier[]
  armyUpkeep: ResourceRateMap
}

const tierNames: Record<PopulationTier, string> = {
  worker: 'Workers',
  technician: 'Technicians',
  scientist: 'Scientists',
  director: 'Directors',
}

function resourceName(type: ResourceTypeKey): string {
  return RESOURCE_NAMES[type] || type
}

function percent(value: number): number {
  return Math.round(value * 100)
}

/**
 * Builds ranked economy crisis hints for QA and operator UI.
 */
export function buildEconomyCrisisRecommendations(input: CrisisInput): EconomyCrisisRecommendation[] {
  const recommendations: EconomyCrisisRecommendation[] = []

  for (const tier of input.populationNeeds.filter(item => item.population > 0)) {
    if (tier.population > tier.housingCapacity) {
      const overflow = tier.population - tier.housingCapacity
      recommendations.push({
        id: `overcrowding:${tier.tier}`,
        code: 'overcrowding',
        severity: overflow >= 5 ? 'critical' : 'warning',
        title: `${tierNames[tier.tier]}: жилье переполнено`,
        detail: `Нужно еще ${overflow} housing capacity, иначе happiness режется штрафом.`,
        priority: 90 + overflow,
        tier: tier.tier,
      })
    }

    if (tier.happiness < 50) {
      recommendations.push({
        id: `happiness:${tier.tier}`,
        code: 'low_happiness',
        severity: tier.happiness < 20 ? 'critical' : 'warning',
        title: `${tierNames[tier.tier]}: низкое счастье`,
        detail: `Текущий happiness ${tier.happiness}%, рост может остановиться или уйти в decline.`,
        priority: 100 - tier.happiness,
        tier: tier.tier,
      })
    }

    for (const need of tier.needs.filter(item => item.satisfaction < 0.999)) {
      const isBasic = need.category === 'basic'
      if (!isBasic && need.satisfaction >= 0.75) continue
      recommendations.push({
        id: `need:${tier.tier}:${need.resource}`,
        code: isBasic ? 'basic_need_shortage' : 'comfort_need_shortage',
        severity: isBasic && need.satisfaction < 0.5 ? 'critical' : 'warning',
        title: `${tierNames[tier.tier]}: дефицит ${resourceName(need.resource)}`,
        detail: `Покрыто ${percent(need.satisfaction)}% потребности (${Math.round(need.available)}/${Math.round(need.required)}).`,
        priority: (isBasic ? 120 : 60) - percent(need.satisfaction),
        resource: need.resource,
        tier: tier.tier,
      })
    }
  }

  for (const [type, value] of Object.entries(input.scarcity)) {
    const resource = type as ResourceTypeKey
    if (!value || value.factor >= 0.999) continue
    const impacted = input.buildings.filter(building => building.throttleReasons[resource] !== undefined).length
    recommendations.push({
      id: `scarcity:${resource}`,
      code: 'input_scarcity',
      severity: value.factor < 0.5 ? 'critical' : 'warning',
      title: `Input bottleneck: ${resourceName(resource)}`,
      detail: `${impacted} зданий throttled, доступно ${percent(value.factor)}% входного ресурса.`,
      priority: 95 - percent(value.factor) + impacted,
      resource,
    })
  }

  for (const resource of input.resources) {
    const rate = input.net[resource.type] || 0
    const capacity = resource.capacity ?? 0
    const fillRatio = capacity > 0 ? resource.amount / capacity : 0
    if (rate > 0.01 && fillRatio >= 0.95) {
      recommendations.push({
        id: `storage:${resource.type}`,
        code: 'storage_full',
        severity: fillRatio >= 1 ? 'warning' : 'info',
        title: `${resourceName(resource.type)} почти на складе`,
        detail: `Заполнено ${percent(Math.min(fillRatio, 1))}% лимита, прирост скоро перестанет накапливаться.`,
        priority: 45 + Math.round(Math.min(fillRatio, 1) * 20),
        resource: resource.type,
      })
    }

    if (rate >= -0.01) continue
    const hoursLeft = resource.amount / Math.abs(rate)
    if (hoursLeft > 8) continue
    recommendations.push({
      id: `depletion:${resource.type}`,
      code: 'resource_depletion',
      severity: hoursLeft <= 2 ? 'critical' : 'warning',
      title: `${resourceName(resource.type)} уходит в минус`,
      detail: `Запаса хватит примерно на ${Math.max(0, Math.round(hoursLeft * 10) / 10)} ч. при текущем net rate.`,
      priority: 85 - Math.round(hoursLeft * 5),
      resource: resource.type,
    })
  }

  for (const [type, upkeep] of Object.entries(input.armyUpkeep)) {
    const resource = type as ResourceTypeKey
    if (!upkeep || upkeep <= 0 || (input.net[resource] || 0) >= 0) continue
    recommendations.push({
      id: `army:${resource}`,
      code: 'army_upkeep_pressure',
      severity: 'info',
      title: `Армия давит на ${resourceName(resource)}`,
      detail: `Upkeep армии ${Math.round(upkeep * 10) / 10}/h участвует в отрицательном балансе.`,
      priority: 35,
      resource,
    })
  }

  return recommendations.sort((a, b) => b.priority - a.priority).slice(0, 6)
}
