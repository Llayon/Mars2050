import { getServerClient } from '@/domains/resource/resource.server'
import { STARTING_RESOURCES } from '@/domains/building/building.config'

/**
 * Initialize starting resources for a new colony.
 * Skips if resources already exist.
 * @param colonyId - Colony ID to initialize
 * @returns Success status with count of resources created
 */
export async function initColonyResources(colonyId: string): Promise<{ success: boolean; error?: string; count?: number }> {
  const supabase = getServerClient()

  const { data: existing } = await supabase
    .from('resources')
    .select('id')
    .eq('colony_id', colonyId)
    .limit(1)

  if (existing && existing.length > 0) {
    return { success: true, error: undefined, count: 0 }
  }

  const rows = Object.entries(STARTING_RESOURCES).map(([type, amount]) => ({
    colony_id: colonyId,
    type,
    amount,
    production_rate: 0,
    consumption_rate: 0
  }))

  const { error } = await supabase.from('resources').insert(rows)
  if (error) return { success: false, error: error.message }

  return { success: true, count: rows.length }
}

/**
 * Initialize starting population for a colony.
 */
export async function initColonyPopulation(colonyId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getServerClient()
  const { data: existing } = await supabase.from('population').select('id').eq('colony_id', colonyId).single()
  
  if (existing) {
    return { success: true }
  }

  const { error } = await supabase.from('population').insert({
    colony_id: colonyId,
    workers: 10,
    technicians: 0,
    scientists: 0,
    directors: 0,
    happiness_workers: 100,
    happiness_technicians: 100,
    happiness_scientists: 100,
    happiness_directors: 100
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}