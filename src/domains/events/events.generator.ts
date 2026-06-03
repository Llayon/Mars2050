import { getServerClient } from '@/domains/resource/resource.server'
import { createEvent } from './events.service'
import { EVENT_CONFIG } from './events.config'
import type { EventType } from './events.types'

// Weight for random selection (higher = more likely)
const EVENT_WEIGHTS: Partial<Record<EventType, number>> = {
  dust_storm: 30,
  meteor_shower: 15,
  anomaly_discovered: 25,
  resource_vein: 20,
  cold_wave: 15,
  solar_flare: 10,
}

/**
 * Generate a random event for a colony.
 * Checks cooldowns to avoid spamming same event type.
 * @param colonyId - Colony ID to generate event for
 * @returns Event type name if generated, null if no event
 */
export async function generateRandomEvent(colonyId: string): Promise<string | null> {
  const supabase = getServerClient()

  // Check cooldowns - get last event of each type
  const { data: recentEvents } = await supabase
    .from('events')
    .select('type, created_at')
    .eq('colony_id', colonyId)
    .order('created_at', { ascending: false })
    .limit(20)

  const now = new Date()
  const availableTypes: EventType[] = []

  for (const [type, config] of Object.entries(EVENT_CONFIG) as [EventType, { cooldown_hours: number }][]) {
    const lastEvent = recentEvents?.find(e => e.type === type)
    if (lastEvent) {
      const hoursSince = (now.getTime() - new Date(lastEvent.created_at).getTime()) / (1000 * 60 * 60)
      if (hoursSince < config.cooldown_hours) continue
    }
    // Add to available list with weight
    const weight = EVENT_WEIGHTS[type] || 10
    for (let i = 0; i < weight; i++) {
      availableTypes.push(type)
    }
  }

  if (availableTypes.length === 0) return null

  // Random selection
  const randomType = availableTypes[Math.floor(Math.random() * availableTypes.length)] as EventType

  const event = await createEvent({
    colony_id: colonyId,
    type: randomType,
  })

  return event ? randomType : null
}

/**
 * Trigger event generation for all active colonies.
 * Should be called periodically (e.g., via cron or Supabase Edge Function).
 * @returns Number of events generated
 */
export async function generateEventsForAllColonies(): Promise<number> {
  const supabase = getServerClient()

  const { data: colonies } = await supabase
    .from('colonies')
    .select('id')

  if (!colonies) return 0

  let generated = 0
  for (const colony of colonies) {
    const result = await generateRandomEvent(colony.id)
    if (result) generated++
  }

  return generated
}
