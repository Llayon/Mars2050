import { getServerClient } from '@/domains/resource/resource.server'
import { getActiveEvents, applyEventModifiers, processExpiredEvents as processEvts } from '@/domains/events/events.service'
import { processCompletedEvents } from './resource.events'
import { generateRandomEvent } from '@/domains/events/events.generator'
import type { ResourceRow } from './resource.types'
import { getEffectiveProduction } from '@/domains/building/building.production'
import { POPULATION_TIERS } from '@/domains/population/population.config'
import type { PopulationState, PopulationTier } from '@/domains/population/population.types'
import { calculateArmyUpkeep } from '@/domains/combat/combat.upkeep'

import { processPopulationTick } from '@/domains/population/population.tick'

/**
 * Lazy recalculation of colony resources, rates, and population ticks.
 * Calculates dynamic rates and updates the resource amounts in DB.
 *
 * @param colonyId - Colony ID to process
 * @returns Promise resolving to updated resource rows, or null on error
 */
export async function recalculateResources(colonyId: string) {
  const supabase = getServerClient()

  // 1. Fetch all colony data in parallel (1 network roundtrip instead of 5 sequential ones)
  const [
    { data: resources, error: resError },
    { data: colony },
    { data: population },
    { data: buildings },
    { data: units }
  ] = await Promise.all([
    supabase.from('resources').select('*').eq('colony_id', colonyId),
    supabase.from('colonies').select('terrain_grid, last_calc_at').eq('id', colonyId).single(),
    supabase.from('population').select('*').eq('colony_id', colonyId).single(),
    supabase.from('buildings').select('*').eq('colony_id', colonyId),
    supabase.from('units').select('*').eq('colony_id', colonyId)
  ])

  if (resError || !resources) {
    console.error('recalculateResources: failed to fetch resources', resError)
    return null
  }

  let updatedResources = resources
  let elapsedHours = 0

  // 2. Calculate dynamic rates based on buildings, population, and units
  try {
    if (colony?.last_calc_at) {
      const lastCalc = new Date(colony.last_calc_at).getTime()
      elapsedHours = Math.max(0, (Date.now() - lastCalc) / 3600000.0)
    }

    const terrainGrid = colony?.terrain_grid || []

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
        const { production, consumption } = getEffectiveProduction(b, population as PopulationState | null, buildings, terrainGrid)
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

    // Army upkeep
    if (units) {
      const armyUpkeep = calculateArmyUpkeep(units)
      for (const [res, val] of Object.entries(armyUpkeep)) {
        newCons[res] = (newCons[res] || 0) + val
      }
    }

    // Update resources in DB in parallel if rates changed
    const updatePromises: PromiseLike<any>[] = []
    for (const r of resources as ResourceRow[]) {
      const p = newProd[r.type] || 0
      const c = newCons[r.type] || 0
      
      if (Math.abs(r.production_rate - p) > 0.01 || Math.abs(r.consumption_rate - c) > 0.01) {
        updatePromises.push(
          supabase
            .from('resources')
            .update({ production_rate: p, consumption_rate: c })
            .eq('id', r.id)
        )
        r.production_rate = p
        r.consumption_rate = c
      }
    }
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises)
    }
  } catch (err) {
    console.error('Error calculating dynamic rates:', err)
  }

  // 3. Catch up offline progress via PostgreSQL RPC using the updated rates
  const { data: finalResources, error: rpcError } = await supabase
    .rpc('recalculate_resources', { p_colony_id: colonyId })

  if (rpcError || !finalResources || finalResources.length === 0) {
    console.error('recalculateResources RPC error:', rpcError)
  } else {
    updatedResources = finalResources
  }

  // 3.5 Process population tick (growth & happiness) based on elapsed time using prefetched data
  if (elapsedHours > 0) {
    await processPopulationTick(colonyId, elapsedHours, {
      population,
      buildings: buildings || [],
      resources: updatedResources
    }).catch(err => 
      console.error('Error processing population tick:', err)
    )
  }

  // 4. Process events in parallel (non-blocking for resource display)
  const [activeEvents] = await Promise.all([
    getActiveEvents(colonyId).catch(() => []),
    processEvts(colonyId).catch(() => {}),
    processCompletedEvents(colonyId).catch(() => {}),
  ])

  // 5. Apply event modifiers to returned resources (client-side display)
  const baseRates: Record<string, number> = {}
  for (const r of updatedResources) {
    baseRates[r.type] = r.production_rate - r.consumption_rate
  }
  const modifiedRates = applyEventModifiers(baseRates, activeEvents)

  // 6. Random chance to trigger new event (fire-and-forget)
  if (Math.random() < 0.05) {
    generateRandomEvent(colonyId).catch(() => {})
  }

  // 7. Return resources with modified rates applied
  return updatedResources.map((r: ResourceRow) => ({
    ...r,
    amount: Math.round((r.amount + (modifiedRates[r.type] - baseRates[r.type]) || 0) * 100) / 100,
  }))
}
