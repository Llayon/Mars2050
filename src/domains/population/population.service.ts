import { getServerClient } from '@/domains/resource/resource.server'
import type { PopulationState, PopulationTier } from './population.types'
import { POPULATION_TIERS } from './population.config'
import { apiError } from '@/lib/api-error'

interface UpgradePopulationTransactionResult {
  success?: boolean
  population?: PopulationState
  error?: string
}

function getTargetTier(fromTier: string): PopulationTier | null {
  if (fromTier === 'worker') return 'technician'
  if (fromTier === 'technician') return 'scientist'
  if (fromTier === 'scientist') return 'director'
  return null
}

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

  const targetTier = getTargetTier(fromTier)
  if (!targetTier) {
    return { error: apiError('BAD_REQUEST', 'Invalid tier for upgrade') }
  }

  const sourceTier = fromTier as PopulationTier
  const sourceConfig = POPULATION_TIERS[sourceTier]
  const targetConfig = POPULATION_TIERS[targetTier]

  const { data: txResult, error: txError } = await supabase.rpc('upgrade_population_transaction', {
    p_colony_id: colonyId,
    p_from_tier: sourceTier,
    p_count: count,
    p_costs: sourceConfig.upgradeCost ?? {},
    p_upgrade_building: sourceConfig.upgradeBuilding,
    p_target_housing: targetConfig.housingPerBuilding,
    p_min_happiness: 80
  })

  if (txError) {
    return { error: apiError('INTERNAL_ERROR', txError.message) }
  }

  const result = txResult as UpgradePopulationTransactionResult
  if (!result.success) {
    return { error: apiError('BAD_REQUEST', result.error || 'Population upgrade failed') }
  }

  if (!result.population) {
    return { error: apiError('INTERNAL_ERROR', 'Population upgrade returned no data') }
  }

  return { data: result.population }
}
