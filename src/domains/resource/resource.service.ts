import { getServerClient } from '@/domains/resource/resource.server'
import { isMissingResourceCapacityError } from './resource.schema-compat'
import { getActiveEvents, applyEventModifiers, processExpiredEvents as processEvts } from '@/domains/events/events.service'
import { processCompletedEvents } from './resource.events'
import { generateRandomEvent } from '@/domains/events/events.generator'
import type { ResourceRow } from './resource.types'
import { applyInputScarcity, type BuildingRateInput } from './resource.economy'
import { calculateResourceCapacities, capResourceAmount } from './resource.storage'
import { getEffectiveProduction } from '@/domains/building/building.production'
import { allocateBuildingStaffing } from '@/domains/building/building.staffing'
import type { BuildingRow } from '@/domains/building/building.types'
import { POPULATION_TIERS } from '@/domains/population/population.config'
import type { PopulationState, PopulationTier } from '@/domains/population/population.types'
import { calculateArmyUpkeep } from '@/domains/combat/combat.upkeep'
import { getReservedWorkOrderSlots, processCompletedWorkOrders } from '@/domains/work-order/work-order.service'
import type { WorkOrderRow } from '@/domains/work-order/work-order.types'

import { processPopulationTick } from '@/domains/population/population.tick'

type ServerClient = ReturnType<typeof getServerClient>

async function updateResourceRateRow(
  supabase: ServerClient,
  resourceId: string,
  values: { production_rate: number; consumption_rate: number; capacity: number }
) {
  const withCapacity = await supabase.from('resources').update(values).eq('id', resourceId)
  if (!withCapacity.error || !isMissingResourceCapacityError(withCapacity.error)) return withCapacity

  return supabase
    .from('resources')
    .update({ production_rate: values.production_rate, consumption_rate: values.consumption_rate })
    .eq('id', resourceId)
}

/**
 * Lazy recalculation of colony resources, rates, and population ticks.
 * Calculates dynamic rates and updates the resource amounts in DB.
 *
 * @param colonyId - Colony ID to process
 * @returns Promise resolving to updated resource rows, or null on error
 */
export async function recalculateResources(colonyId: string) {
  const supabase = getServerClient()
  await processCompletedWorkOrders(colonyId).catch(err => console.error('Error processing work orders:', err))

  // 1. Fetch all colony data in parallel
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
    const capacityByResource = calculateResourceCapacities((buildings || []) as BuildingRow[])

    const newProd: Record<string, number> = {}
    const newCons: Record<string, number> = {}

    // Initialize with 0
    resources.forEach((r: ResourceRow) => {
      newProd[r.type] = 0
      newCons[r.type] = 0
    })

    // 2.5 Allocate staffing
    if (buildings && population) {
      const reservedSlots = getReservedWorkOrderSlots((activeWorkOrders || []) as unknown as WorkOrderRow[])
      const assignments = allocateBuildingStaffing(buildings, population as PopulationState, reservedSlots)
      const buildingUpdates: PromiseLike<unknown>[] = []
  
      for (const b of buildings) {
        if (b.assigned_workers !== assignments[b.id]) {
          b.assigned_workers = assignments[b.id]
          buildingUpdates.push(
            supabase.from('buildings')
              .update({ assigned_workers: b.assigned_workers })
              .eq('id', b.id)
          )
        }
      }
      if (buildingUpdates.length > 0) {
        await Promise.all(buildingUpdates).catch(err => console.error('Failed to update building assignments', err))
      }
    }

    // Buildings production & consumption
    const buildingRateInputs: BuildingRateInput[] = []
    if (buildings) {
      for (const b of buildings) {
        const { production, consumption } = getEffectiveProduction(b, population as PopulationState | null, buildings, terrainGrid)
        buildingRateInputs.push({
          buildingId: b.id,
          buildingType: b.type,
          production,
          consumption,
        })
      }

      const throttled = applyInputScarcity(buildingRateInputs, resources as ResourceRow[], elapsedHours)
      for (const building of throttled.buildings) {
        for (const [res, val] of Object.entries(building.production)) newProd[res] = (newProd[res] || 0) + val
        for (const [res, val] of Object.entries(building.consumption)) newCons[res] = (newCons[res] || 0) + val
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
    const updatePromises: PromiseLike<unknown>[] = []
    for (const r of resources as ResourceRow[]) {
      const p = newProd[r.type] || 0
      const c = newCons[r.type] || 0
      const capacity = Math.max(capacityByResource[r.type], r.amount)
      const rateChanged = Math.abs(r.production_rate - p) > 0.01 || Math.abs(r.consumption_rate - c) > 0.01
      const capacityChanged = Math.abs((r.capacity ?? 0) - capacity) > 0.01
      
      if (rateChanged || capacityChanged) {
        updatePromises.push(
          updateResourceRateRow(supabase, r.id, { production_rate: p, consumption_rate: c, capacity })
        )
        r.production_rate = p
        r.consumption_rate = c
        r.capacity = capacity
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
    amount: Math.round(capResourceAmount(r.amount + ((modifiedRates[r.type] || 0) - (baseRates[r.type] || 0)), r.capacity ?? r.amount) * 100) / 100,
  }))
}
