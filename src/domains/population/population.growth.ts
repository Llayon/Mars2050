import { HAPPINESS_GROWTH_MULT, POPULATION_TIERS } from './population.config'
import type { PopulationTier, TierNeed } from './population.types'
import type { ResourceRow } from '@/domains/resource/resource.types'

/**
 * Calculates average satisfaction for a group of needs.
 */
export function calculateNeedsSatisfaction(
  needs: TierNeed[],
  tierPop: number,
  resources: ResourceRow[],
): number {
  if (needs.length === 0) return 1
  if (tierPop <= 0) return 1

  const findResource = (type: string) => resources.find(r => r.type === type)?.amount || 0

  return needs.reduce((sum, need) => {
    const available = findResource(need.resource)
    const required = need.amountPer10 * (tierPop / 10)
    if (required <= 0) return sum + 1
    return sum + Math.min(available / required, 1)
  }, 0) / needs.length
}

/**
 * Calculates happiness for a tier based on needs satisfaction.
 * @returns happiness 0-100
 */
export function calculateTierHappiness(
  tier: PopulationTier,
  tierPop: number,
  resources: ResourceRow[],
  housingCapacity: number,
): number {
  if (tierPop === 0) return 50

  const config = POPULATION_TIERS[tier]
  let happiness = 50 // base

  // Basic needs are survival-critical: satisfied needs grant up to +30,
  // missing needs apply up to -50. This makes famine/oxygen/water shortages severe.
  const basicNeeds = config.needs.filter(n => n.category === 'basic')
  const basicSatisfaction = calculateNeedsSatisfaction(basicNeeds, tierPop, resources)
  happiness += basicSatisfaction * 30
  happiness -= (1 - basicSatisfaction) * 50

  // +15 max from comfort needs
  const comfortNeeds = config.needs.filter(n => n.category === 'comfort')
  if (comfortNeeds.length > 0) {
    const comfortSat = calculateNeedsSatisfaction(comfortNeeds, tierPop, resources)
    happiness += comfortSat * 15
  }

  // +10 max from luxury needs
  const luxuryNeeds = config.needs.filter(n => n.category === 'luxury')
  if (luxuryNeeds.length > 0) {
    const luxurySat = calculateNeedsSatisfaction(luxuryNeeds, tierPop, resources)
    happiness += luxurySat * 10
  }

  // -20 overcrowding
  if (tierPop > housingCapacity) happiness -= 20

  return Math.max(0, Math.min(100, Math.round(happiness)))
}

/**
 * Calculates population growth/decline for one tick.
 * @returns delta (positive = growth, negative = decline)
 */
export function calculateGrowthDelta(
  happiness: number,
  freeHousing: number,
): number {
  if (freeHousing <= 0 && happiness >= 50) return 0 // Can't grow if no housing, but doesn't decline if happy

  // Find applicable multiplier
  const thresholds = Object.keys(HAPPINESS_GROWTH_MULT).map(Number).sort((a, b) => b - a)
  
  for (const threshold of thresholds) {
    if (happiness >= threshold) {
      const delta = HAPPINESS_GROWTH_MULT[threshold] || 0
      // If delta is positive but no free housing, cap it at 0
      return (delta > 0 && freeHousing <= 0) ? 0 : delta
    }
  }
  
  return -1 // catastrophic decline
}
