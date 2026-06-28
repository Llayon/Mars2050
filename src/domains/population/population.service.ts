import { getServerClient } from '@/domains/resource/resource.server'
import type { PopulationState } from './population.types'
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
export async function upgradePopulation(colonyId: string, fromTier: string, count: number): Promise<{ data?: PopulationState; error?: unknown }> {
  const supabase = getServerClient()

  const { data: pop } = await getPopulation(colonyId)
  if (!pop) {
    return { error: apiError('NOT_FOUND', 'Population not found') }
  }

  // Determine upgrade path
  let fromField = ''
  let toField = ''
  
  if (fromTier === 'worker') {
    fromField = 'workers'
    toField = 'technicians'
  } else if (fromTier === 'technician') {
    fromField = 'technicians'
    toField = 'scientists'
  } else if (fromTier === 'scientist') {
    fromField = 'scientists'
    toField = 'directors'
  } else {
    return { error: apiError('BAD_REQUEST', 'Invalid tier for upgrade') }
  }

  const currentFrom = pop[fromField as keyof PopulationState] as number
  if (currentFrom < count) {
    return { error: apiError('BAD_REQUEST', `Not enough ${fromTier}s to upgrade`) }
  }

  // Deduct from current, add to next
  const updates: Partial<PopulationState> = {}
  updates[fromField as keyof PopulationState] = currentFrom - count as never
  updates[toField as keyof PopulationState] = (pop[toField as keyof PopulationState] as number) + count as never

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
