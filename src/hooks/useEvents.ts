'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSubscription } from './useSubscription'

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
  const mountedRef = useRef(true)

  const fetchEvents = useCallback(async () => {
    if (!colonyId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/events?colony_id=${colonyId}&active_only=true`)
      if (!res.ok) throw new Error('Failed to fetch events')
      const data = await res.json()
      if (mountedRef.current) setEvents(data)
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [colonyId])

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])
  useEffect(() => { fetchEvents() }, [fetchEvents])

  // Realtime: insert → add event, update → sync fields, delete → remove
  useSubscription('events', colonyId, (payload) => {
    const ev = payload.new as unknown as GameEvent
    if (payload.eventType === 'INSERT') {
      setEvents(prev => prev.some(e => e.id === ev.id) ? prev : [...prev, ev])
    } else if (payload.eventType === 'UPDATE') {
      setEvents(prev => prev.map(e => e.id === ev.id ? ev : e))
    } else if (payload.eventType === 'DELETE') {
      setEvents(prev => prev.filter(e => e.id !== payload.old.id))
    }
  })

  const createEvent = async (colonyId: string, type?: string, durationMinutes?: number): Promise<boolean> => {
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
