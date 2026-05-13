import { getServerClient } from '@/domains/resource/resource.server'
import { getActiveEvents, applyEventModifiers, processExpiredEvents as processEvts } from '@/domains/events/events.service'
import { processCompletedEvents } from './resource.events'
import { generateRandomEvent } from '@/domains/events/events.generator'

/**
 * Lazy resource calculation.
 * Call before ANY game action (build, attack, trade, etc.)
 *
 * Formula: new_amount = amount + (production_rate - consumption_rate) * hours_elapsed
 * Modified by active events (dust storms, etc.)
 *
 * @param colonyId - Colony ID to recalculate for
 * @returns Updated resources array
 */
export async function recalculateResources(colonyId: string) {
  const supabase = getServerClient()

  // 1. Get colony's last_calc_at
  const { data: colony, error: colonyError } = await supabase
    .from('colonies')
    .select('last_calc_at')
    .eq('id', colonyId)
    .single()

  if (colonyError || !colony) {
    console.error('recalculateResources: colony not found', colonyError)
    return null
  }

  // 2. Calculate elapsed time in hours
  const lastCalcAt = new Date(colony.last_calc_at)
  const now = new Date()
  const elapsedMs = now.getTime() - lastCalcAt.getTime()
  const elapsedHours = elapsedMs / (1000 * 60 * 60)

  // Skip if less than 1 second elapsed (avoid unnecessary updates)
  if (elapsedMs < 1000) {
    const { data } = await supabase
      .from('resources')
      .select('*')
      .eq('colony_id', colonyId)
    return data
  }

  // 3. Get current resources
  const { data: resources, error: resourcesError } = await supabase
    .from('resources')
    .select('*')
    .eq('colony_id', colonyId)

  if (resourcesError || !resources) {
    console.error('recalculateResources: resources not found', resourcesError)
    return null
  }

  // 4. Get active events and apply modifiers
  const activeEvents = await getActiveEvents(colonyId)
  const baseRates: Record<string, number> = {}
  for (const r of resources) {
    baseRates[r.type] = r.production_rate - r.consumption_rate
  }
  const modifiedRates = applyEventModifiers(baseRates, activeEvents)

  // 5. Update each resource
  for (const r of resources) {
    const rate = modifiedRates[r.type] || 0
    const growth = rate * elapsedHours
    const newAmount = Math.max(0, r.amount + growth)

    await supabase
      .from('resources')
      .update({ amount: Math.round(newAmount * 100) / 100 })
      .eq('colony_id', colonyId)
      .eq('type', r.type)
  }

  // 6. Update last_calc_at on colony
  await supabase
    .from('colonies')
    .update({ last_calc_at: now.toISOString() })
    .eq('id', colonyId)

  // 7. Process expired events (deactivate + instant rewards)
  await processEvts(colonyId)

  // 8. Process pending events that have completed
  await processCompletedEvents(colonyId)

  // 9. Random chance to trigger new event (5% per recalculation)
  if (Math.random() < 0.05) {
    await generateRandomEvent(colonyId)
  }

  // 10. Return updated resources
  const { data: updatedResources } = await supabase
    .from('resources')
    .select('*')
    .eq('colony_id', colonyId)

  return updatedResources
}
