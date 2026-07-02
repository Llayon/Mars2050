import { getServerClient } from '@/domains/resource/resource.server'
import type { PopulationState } from './population.types'
import { POPULATION_TIERS } from './population.config'
import { apiError } from '@/lib/api-error'

/**
 * Gets population state for a colony.
 */
export async function getPopulation(colonyId: string): Promise<{ data?: PopulationState; error?: string }> {
  const supabase = getServerClient()

  const { data, error } = await supabase
    .from('population')
    .select('*')
    .eq('colony_id', colonyId)
    .single()

  if (error || !data) {
    return { error: error?.message || 'Population not found' }
  }

  return { data: data as PopulationState }
}

/**
 * Upgrades population from one tier to the next.
 */
export async function upgradePopulation(userId: string, colonyId: string, fromTier: string, count: number): Promise<{ data?: PopulationState; error?: unknown }> {
  const supabase = getServerClient()

  // Verify colony ownership
  const { data: colony, error: colError } = await supabase
    .from('colonies')
    .select('id')
    .eq('id', colonyId)
    .eq('user_id', userId)
    .single()

  if (colError || !colony) {
    return { error: apiError('FORBIDDEN', 'Colony not found or access denied') }
  }

  const { data: pop } = await getPopulation(colonyId)
  if (!pop) {
    return { error: apiError('NOT_FOUND', 'Population not found') }
  }

  // Determine upgrade path
  let fromField = ''
  let toField = ''
  let toTierKey: keyof typeof POPULATION_TIERS
  
  if (fromTier === 'worker') {
    fromField = 'workers'
    toField = 'technicians'
    toTierKey = 'technician'
  } else if (fromTier === 'technician') {
    fromField = 'technicians'
    toField = 'scientists'
    toTierKey = 'scientist'
  } else if (fromTier === 'scientist') {
    fromField = 'scientists'
    toField = 'directors'
    toTierKey = 'director'
  } else {
    return { error: apiError('BAD_REQUEST', 'Invalid tier for upgrade') }
  }

  const currentFrom = pop[fromField as keyof PopulationState] as number
  if (currentFrom < count) {
    return { error: apiError('BAD_REQUEST', `Not enough ${fromTier}s to upgrade`) }
  }

  // Enforce Anno-style upgrade constraints
  const tierConfig = POPULATION_TIERS[fromTier as keyof typeof POPULATION_TIERS]
  const toTierConfig = POPULATION_TIERS[toTierKey]
  
  // 1. Check Needs (Happiness)
  const happinessField = `happiness_${fromField}` as keyof PopulationState
  const currentHappiness = pop[happinessField] as number
  if (currentHappiness < 80) {
    return { error: apiError('BAD_REQUEST', 'Уровень счастья должен быть не ниже 80% для модернизации (потребности не удовлетворены)') }
  }

  // 2. Check Upgrade Building
  const { data: buildings } = await supabase
    .from('buildings')
    .select('type')
    .eq('colony_id', colonyId)
    .eq('is_active', true)

  if (tierConfig.upgradeBuilding) {
    const hasUpgrader = buildings?.some(b => b.type === tierConfig.upgradeBuilding)
    if (!hasUpgrader) {
      return { error: apiError('BAD_REQUEST', `Для улучшения требуется активное здание: ${tierConfig.upgradeBuilding}`) }
    }
  }

  // 3. Check Housing Capacity for new tier
  let maxHousing = 0
  buildings?.forEach(b => {
    const housing = toTierConfig.housingPerBuilding[b.type as keyof typeof toTierConfig.housingPerBuilding]
    if (housing) maxHousing += housing
  })

  const currentTo = pop[toField as keyof PopulationState] as number
  if (currentTo + count > maxHousing) {
    return { error: apiError('BAD_REQUEST', `Не хватает жилья для расселения ${toTierConfig.name} (Максимум: ${maxHousing})`) }
  }

  // 4. Check and Deduct Upgrade Cost
  if (tierConfig.upgradeCost) {
    const { data: resources } = await supabase
      .from('resources')
      .select('*')
      .eq('colony_id', colonyId)

    // Validate all costs first
    for (const [resType, costPerUnit] of Object.entries(tierConfig.upgradeCost)) {
      const totalCost = costPerUnit * count
      const currentRes = resources?.find(r => r.type === resType)
      if (!currentRes || currentRes.amount < totalCost) {
        return { error: apiError('BAD_REQUEST', `Недостаточно ресурсов. Требуется ${totalCost} ${resType}`) }
      }
    }

    // Deduct costs (using sequential updates since it's outside the Postgres RPC for now)
    for (const [resType, costPerUnit] of Object.entries(tierConfig.upgradeCost)) {
      const totalCost = costPerUnit * count
      const currentAmount = resources!.find(r => r.type === resType)!.amount
      await supabase
        .from('resources')
        .update({ amount: currentAmount - totalCost })
        .eq('colony_id', colonyId)
        .eq('type', resType)
    }
  }

  // 5. Deduct from current, add to next
  const updates: Partial<PopulationState> = {}
  updates[fromField as keyof PopulationState] = currentFrom - count as never
  updates[toField as keyof PopulationState] = currentTo + count as never

  const { data: updated, error } = await supabase
    .from('population')
    .update(updates)
    .eq('colony_id', colonyId)
    .select()
    .single()

  if (error || !updated) {
    return { error: apiError('INTERNAL_ERROR', error?.message || 'Failed to update population') }
  }

  return { data: updated as PopulationState }
}
