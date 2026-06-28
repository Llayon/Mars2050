import { getServerClient } from '@/domains/resource/resource.server'
import { POPULATION_TIERS } from './population.config'
import { calculateTierHappiness, calculateGrowthDelta } from './population.growth'
import type { PopulationState, PopulationTier } from './population.types'
import type { BuildingTypeKey } from '@/domains/building/building.types'

/**
 * Recalculates housing capacity, happiness per tier, and processes growth/decline.
 * Should be called during the resource recalculation tick.
 *
 * @param colonyId - Colony ID to process
 * @param elapsedHours - Elapsed time since last tick
 */
export async function processPopulationTick(colonyId: string, elapsedHours: number) {
  const supabase = getServerClient()

  // 1. Fetch population, buildings, and resources
  const { data: pop } = await supabase.from('population').select('*').eq('colony_id', colonyId).single()
  const { data: buildings } = await supabase.from('buildings').select('*').eq('colony_id', colonyId)
  const { data: resources } = await supabase.from('resources').select('*').eq('colony_id', colonyId)

  if (!pop || !buildings || !resources) return

  // 2. Calculate housing capacities per tier
  const housingCapacity = {
    worker: 0,
    technician: 0,
    scientist: 0,
    director: 0
  }

  for (const b of buildings) {
    if (!b.is_active) continue
    for (const tier of ['worker', 'technician', 'scientist', 'director'] as const) {
      const cap = POPULATION_TIERS[tier].housingPerBuilding[b.type as BuildingTypeKey] || 0
      housingCapacity[tier] += cap * (b.level || 1)
    }
  }

  // 3. Calculate happiness for each tier
  const happiness = {
    worker: calculateTierHappiness('worker', pop.workers, resources, housingCapacity.worker),
    technician: calculateTierHappiness('technician', pop.technicians, resources, housingCapacity.technician),
    scientist: calculateTierHappiness('scientist', pop.scientists, resources, housingCapacity.scientist),
    director: calculateTierHappiness('director', pop.directors, resources, housingCapacity.director)
  }

  // 4. Update growth progress (applies only to workers)
  const freeWorkerHousing = housingCapacity.worker - pop.workers
  const delta = calculateGrowthDelta(happiness.worker, freeWorkerHousing)
  
  let newGrowthProgress = Number(pop.growth_progress) + delta * elapsedHours * 100 // Scale delta to 100 points
  let newWorkers = pop.workers

  // Each 100 points adds/subtracts a worker
  if (newGrowthProgress >= 100) {
    const added = Math.floor(newGrowthProgress / 100)
    const maxCanAdd = Math.max(0, housingCapacity.worker - newWorkers)
    const toAdd = Math.min(added, maxCanAdd)
    newWorkers += toAdd
    newGrowthProgress = toAdd > 0 ? (newGrowthProgress % 100) : 100 // clamp progress if housing cap hit
  } else if (newGrowthProgress < 0) {
    const removed = Math.floor(Math.abs(newGrowthProgress) / 100) + 1
    newWorkers = Math.max(0, newWorkers - removed)
    newGrowthProgress = newWorkers > 0 ? (100 - (Math.abs(newGrowthProgress) % 100)) : 0
  }

  // 5. Update population in DB
  await supabase
    .from('population')
    .update({
      workers: newWorkers,
      growth_progress: newGrowthProgress,
      happiness_workers: happiness.worker,
      happiness_technicians: happiness.technician,
      happiness_scientists: happiness.scientist,
      happiness_directors: happiness.director,
      updated_at: new Date().toISOString()
    })
    .eq('colony_id', colonyId)
}
