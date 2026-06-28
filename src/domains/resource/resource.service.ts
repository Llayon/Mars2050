import { getServerClient } from '@/domains/resource/resource.server'
import { getActiveEvents, applyEventModifiers, processExpiredEvents as processEvts } from '@/domains/events/events.service'
import { processCompletedEvents } from './resource.events'
import { generateRandomEvent } from '@/domains/events/events.generator'
import type { ResourceRow } from './resource.types'
import { getEffectiveProduction } from '@/domains/building/building.production'
import { POPULATION_TIERS } from '@/domains/population/population.config'
import type { PopulationState, PopulationTier } from '@/domains/population/population.types'

/**
 * Lazy resource calculation.
 * First uses PostgreSQL RPC to catch up offline progress.
 * Then calculates dynamic rates based on buildings and population workforce, and saves them.
 *
 * @param colonyId - Colony ID to recalculate for
 * @returns Updated resources array
 */
export async function recalculateResources(colonyId: string) {
  const supabase = getServerClient()

  // 1. Catch up offline progress via PostgreSQL RPC (amount += rate * elapsed_time)
  const { data: resources, error: rpcError } = await supabase
    .rpc('recalculate_resources', { p_colony_id: colonyId })

  if (rpcError) {
    console.error('recalculateResources RPC error:', rpcError)
    return null
  }

  if (!resources || resources.length === 0) {
    console.error('recalculateResources: no resources returned')
    return null
  }

  // 1.5 Calculate dynamic rates based on buildings and population
  try {
    const { data: population } = await supabase.from('population').select('*').eq('colony_id', colonyId).single()
    const { data: buildings } = await supabase.from('buildings').select('*').eq('colony_id', colonyId)

    const newProd: Record<string, number> = {}
    const newCons: Record<string, number> = {}

    // Initialize with 0
    resources.forEach((r: ResourceRow) => {
      newProd[r.type] = 0
      newCons[r.type] = 0
    })

    // Buildings production & consumption
    if (buildings) {
      for (const b of buildings) {
        const { production, consumption } = getEffectiveProduction(b, population as PopulationState | null, buildings)
        for (const [res, val] of Object.entries(production)) newProd[res] = (newProd[res] || 0) + val
        for (const [res, val] of Object.entries(consumption)) newCons[res] = (newCons[res] || 0) + val
      }
    }

    // Population consumption (needs)
    if (population) {
      const popState = population as PopulationState
      const tiers: PopulationTier[] = ['worker', 'technician', 'scientist', 'director']
      
      for (const tier of tiers) {
        const count = popState[`${tier}s` as keyof PopulationState] as number
        if (count > 0) {
          const config = POPULATION_TIERS[tier]
          for (const need of config.needs) {
            newCons[need.resource] = (newCons[need.resource] || 0) + (need.amountPer10 * (count / 10))
          }
        }
      }
    }

    // Update resources in DB if rates changed
    for (const r of resources as ResourceRow[]) {
      const p = newProd[r.type] || 0
      const c = newCons[r.type] || 0
      
      if (Math.abs(r.production_rate - p) > 0.01 || Math.abs(r.consumption_rate - c) > 0.01) {
        await supabase
          .from('resources')
          .update({ production_rate: p, consumption_rate: c })
          .eq('id', r.id)
          
        r.production_rate = p
        r.consumption_rate = c
      }
    }
  } catch (err) {
    console.error('Error calculating dynamic rates:', err)
  }

  // 2. Process events in parallel (non-blocking for resource display)
  const [activeEvents] = await Promise.all([
    getActiveEvents(colonyId).catch(() => []),
    processEvts(colonyId).catch(() => {}),
    processCompletedEvents(colonyId).catch(() => {}),
  ])

  // 3. Apply event modifiers to returned resources (client-side display)
  const baseRates: Record<string, number> = {}
  for (const r of resources) {
    baseRates[r.type] = r.production_rate - r.consumption_rate
  }
  const modifiedRates = applyEventModifiers(baseRates, activeEvents)

  // 4. Random chance to trigger new event (fire-and-forget)
  if (Math.random() < 0.05) {
    generateRandomEvent(colonyId).catch(() => {})
  }

  // 5. Return resources with modified rates applied
  return resources.map((r: ResourceRow) => ({
    ...r,
    amount: Math.round((r.amount + (modifiedRates[r.type] - baseRates[r.type]) || 0) * 100) / 100,
  }))
}
