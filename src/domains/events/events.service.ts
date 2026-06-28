import { getServerClient } from '@/domains/resource/resource.server'
import { EVENT_CONFIG } from './events.config'
import type { EventType, GameEvent, CreateEventDTO } from './events.types'

/**
 * Create a new event for a colony.
 * @param data - Event creation DTO (colony_id, type, optional duration)
 * @returns Created event or null on failure
 */
export async function createEvent(data: CreateEventDTO): Promise<GameEvent | null> {
  const supabase = getServerClient()
  const config = EVENT_CONFIG[data.type]

  const now = new Date()
  const endsAt = data.duration_minutes
    ? new Date(now.getTime() + data.duration_minutes * 60 * 1000).toISOString()
    : undefined

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      colony_id: data.colony_id,
      type: data.type,
      name: config.name,
      description: config.description,
      effect: config.effect,
      duration_minutes: data.duration_minutes || config.default_duration_minutes,
      is_active: true,
      ends_at: endsAt,
    })
    .select('*')
    .single()

  if (error) {
    console.error('createEvent error:', error)
    return null
  }

  return event as unknown as GameEvent
}

/**
 * Get active events for a colony (not expired).
 * @param colonyId - Colony ID
 * @returns Array of active events
 */
export async function getActiveEvents(colonyId: string): Promise<GameEvent[]> {
  const supabase = getServerClient()

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('colony_id', colonyId)
    .eq('is_active', true)
    .or('ends_at.is.null,ends_at.gt.now()')

  if (error) {
    console.error('getActiveEvents error:', error)
    return []
  }

  return (data || []) as unknown as GameEvent[]
}

/**
 * Get all events for a colony (active and expired).
 * @param colonyId - Colony ID
 * @returns Array of all events sorted by date
 */
export async function getAllEvents(colonyId: string): Promise<GameEvent[]> {
  const supabase = getServerClient()

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('colony_id', colonyId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getAllEvents error:', error)
    return []
  }

  return (data || []) as unknown as GameEvent[]
}

/**
 * Deactivate expired events and process instant event rewards.
 * Called during recalculateResources.
 * @param colonyId - Colony ID
 */
export async function processExpiredEvents(colonyId: string): Promise<void> {
  const supabase = getServerClient()
  const now = new Date().toISOString()

  // Деактивировать истекшие события И получить мгновенные — параллельно
  const [{ data: instantEvents }] = await Promise.all([
    supabase
      .from('events')
      .select('*')
      .eq('colony_id', colonyId)
      .eq('is_active', true)
      .is('ends_at', null),
    supabase
      .from('events')
      .update({ is_active: false })
      .eq('colony_id', colonyId)
      .eq('is_active', true)
      .lt('ends_at', now),
  ])

  // Выдать награды за мгновенные события параллельно
  if (instantEvents && instantEvents.length > 0) {
    await Promise.all(
      instantEvents.map(async (event) => {
        await applyEventRewards(colonyId, event as unknown as GameEvent)
        return supabase
          .from('events')
          .update({ is_active: false })
          .eq('id', event.id)
      })
    )
  }
}

/**
 * Apply event effects (production_modifier) to resource rates.
 * Called during resource calculation.
 * @param baseRates - Base production rates per resource type
 * @param events - Active events with modifiers
 * @returns Modified resource rates with event effects applied
 */
export function applyEventModifiers(
  baseRates: Record<string, number>,
  events: GameEvent[]
): Record<string, number> {
  const modifiedRate = { ...baseRates }

  for (const event of events) {
    const effect = event.effect
    if (effect?.production_modifier) {
      for (const [resource, modifier] of Object.entries(effect.production_modifier as Record<string, number>)) {
        modifiedRate[resource] = (modifiedRate[resource] || 0) * (1 + modifier)
      }
    }
  }

  return modifiedRate
}

/**
 * Выдать награды за событие (исследования, ресурсы)
 */
async function applyEventRewards(colonyId: string, event: GameEvent): Promise<void> {
  const supabase = getServerClient()
  const effect = event.effect

  // Награда ресурсами
  if (effect?.resource_bonus) {
    for (const [resource, amount] of Object.entries(effect.resource_bonus as Record<string, number>)) {
      await supabase.rpc('increment_resource', {
        p_colony_id: colonyId,
        p_type: resource,
        p_amount: amount,
      })
    }
  }

  // Награда исследованиями
  if (effect?.research_bonus) {
    await supabase.rpc('increment_resource', {
      p_colony_id: colonyId,
      p_type: 'research_points',
      p_amount: effect.research_bonus,
    })
  }

  // Повреждение зданий (Hazard)
  if (effect?.building_damage) {
    const { data: buildings } = await supabase
      .from('buildings')
      .select('id, type')
      .eq('colony_id', colonyId)
      .eq('is_active', true)

    if (buildings && buildings.length > 0) {
      let targets = buildings
      if (effect.building_damage.type) {
        targets = buildings.filter(b => b.type === effect.building_damage?.type)
      }

      if (targets.length > 0) {
        // Выбираем X процентов зданий для отключения
        const countToDamage = Math.max(1, Math.floor(targets.length * (effect.building_damage.damage_percent / 100)))
        const shuffled = targets.sort(() => 0.5 - Math.random())
        const toDamage = shuffled.slice(0, countToDamage).map(b => b.id)

        await supabase
          .from('buildings')
          .update({ is_active: false }) // TODO: proper repair mechanics / HP
          .in('id', toDamage)
      }
    }
  }
}
