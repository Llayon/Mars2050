import { getServerClient } from '@/domains/resource/resource.server'

/**
 * Update a resource rate (production or consumption) for a colony.
 * Adds or subtracts the given amount from the current rate.
 */
export async function updateResourceRate(
  colonyId: string,
  resourceType: string,
  field: 'production_rate' | 'consumption_rate',
  delta: number
) {
  const supabase = getServerClient()

  const { data: current } = await supabase
    .from('resources')
    .select(field)
    .eq('colony_id', colonyId)
    .eq('type', resourceType)
    .single()

  if (current) {
    const currentValue = (current as Record<string, number>)[field] ?? 0
    const newValue = Math.max(0, currentValue + delta)

    await supabase
      .from('resources')
      .update({ [field]: newValue })
      .eq('colony_id', colonyId)
      .eq('type', resourceType)
  }
}

/**
 * Maps building types to the resource they produce.
 */
export const PRODUCTION_TYPE: Record<string, string> = {
  solar_panels: 'energy',
  oxygen_generator: 'oxygen',
  water_extractor: 'water',
  mine: 'minerals',
  greenhouse: 'food',
  research_lab: 'research_points'
}