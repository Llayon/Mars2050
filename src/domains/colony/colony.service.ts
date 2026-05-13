import { getServerClient } from '@/domains/resource/resource.server'
import { STARTING_RESOURCES } from '@/domains/building/building.config'

/**
 * Initialize starting resources for a new colony.
 * Skips if resources already exist.
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