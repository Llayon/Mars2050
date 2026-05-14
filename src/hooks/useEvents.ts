import { useEffect, useState } from 'react'

interface GameEvent {
  id: string
  colony_id: string
  type: string
  name: string
  description: string
  effect: Record<string, unknown>
  duration_minutes?: number
  is_active: boolean
  created_at: string
  ends_at?: string
}

interface UseEventsReturn {
  events: GameEvent[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  createEvent: (colonyId: string, type: string, durationMinutes?: number) => Promise<boolean>
}

export function useEvents(colonyId: string | null): UseEventsReturn {
  const [events, setEvents] = useState<GameEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = async () => {
    if (!colonyId) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/events?colony_id=${colonyId}&active_only=true`)
      if (!res.ok) throw new Error('Failed to fetch events')
      const data = await res.json()
      setEvents(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
    // Poll every 60 seconds for event updates (was 30s before cache)
    const interval = setInterval(fetchEvents, 60000)
    return () => clearInterval(interval)
  }, [colonyId])

  const createEvent = async (
    colonyId: string,
    type?: string, // Если не указан, создаем случайное
    durationMinutes?: number
  ): Promise<boolean> => {
    try {
      const EVENT_TYPES = ['dust_storm', 'meteor_shower', 'anomaly_discovered', 'resource_vein', 'cold_wave', 'solar_flare'] as const
      const eventType = type || EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)]
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colony_id: colonyId, type: eventType, duration_minutes: durationMinutes }),
      })
      if (!res.ok) return false
      await fetchEvents()
      return true
    } catch {
      return false
    }
  }

  return { events, loading, error, refetch: fetchEvents, createEvent }
}
