import { getServerClient } from '@/domains/resource/resource.server'
import { getActiveEvents, applyEventModifiers, processExpiredEvents as processEvts } from '@/domains/events/events.service'
import { processCompletedEvents } from './resource.events'
import { generateRandomEvent } from '@/domains/events/events.generator'
import type { ResourceRow } from './resource.types'

/**
 * Lazy resource calculation — PostgreSQL RPC optimized.
 * 1 RPC call instead of 10+ database roundtrips.
 *
 * @param colonyId - Colony ID to recalculate for
 * @returns Updated resources array
 */
export async function recalculateResources(colonyId: string) {
  const supabase = getServerClient()

  // 1. Recalculate resources via PostgreSQL RPC (single roundtrip)
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
