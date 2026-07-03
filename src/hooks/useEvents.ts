'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSubscription } from './useSubscription'
import { fetchWithAuth } from '@/lib/fetch-with-auth'

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
  processing: boolean
  refetch: () => Promise<void>
  createEvent: (colonyId: string, type?: string, durationMinutes?: number) => Promise<boolean>
  processNow: () => Promise<void>
}

interface UseEventsOptions {
  enabled?: boolean
  processOnMount?: boolean
  subscribePending?: boolean
}

export function useEvents(colonyId: string | null, options: UseEventsOptions = {}): UseEventsReturn {
  const enabled = options.enabled ?? true
  const processOnMount = options.processOnMount ?? true
  const subscribePending = options.subscribePending ?? true
  const activeColonyId = enabled ? colonyId : null

  const [events, setEvents] = useState<GameEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const mountedRef = useRef(true)

  const fetchEvents = useCallback(async () => {
    if (!activeColonyId) return []
    const res = await fetchWithAuth(`/api/events?colony_id=${activeColonyId}&active_only=true`)
    if (!res.ok) throw new Error('Failed to fetch events')
    return await res.json()
  }, [activeColonyId])

  const processNow = useCallback(async () => {
    if (!activeColonyId || processing) return
    setProcessing(true)
    try {
      await fetchWithAuth('/api/events/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colony_id: activeColonyId }),
      })
    } catch {
      // silent — processing is best-effort
    } finally {
      if (mountedRef.current) setProcessing(false)
    }
  }, [activeColonyId, processing])

  // Fetch pending events once on mount, then rely on Realtime
  useEffect(() => {
    if (!activeColonyId || !processOnMount) return
    const processTimer = setTimeout(() => {
      void processNow()
    }, 1200)
    return () => clearTimeout(processTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colonyId])

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])
  useEffect(() => {
    if (!activeColonyId) {
      setEvents([])
      setLoading(false)
      return
    }
    setLoading(true)
    fetchEvents()
      .then(data => { setEvents(data); setError(null) })
      .catch(err => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => { if (mountedRef.current) setLoading(false) })
  }, [fetchEvents, activeColonyId])

  // Realtime: insert → add event, update → sync fields, delete → remove
  useSubscription('events', activeColonyId, (payload) => {
    const ev = payload.new as unknown as GameEvent
    if (payload.eventType === 'INSERT') {
      setEvents(prev => prev.some(e => e.id === ev.id) ? prev : [...prev, ev])
    } else if (payload.eventType === 'UPDATE') {
      setEvents(prev => prev.map(e => e.id === ev.id ? ev : e))
    } else if (payload.eventType === 'DELETE') {
      setEvents(prev => prev.filter(e => e.id !== payload.old.id))
    }
  })

  // Realtime: listen for pending_events being processed (marker for refresh)
  useSubscription('pending_events', activeColonyId, () => {
    void fetchEvents()
  }, subscribePending)

  const createEvent = async (colonyId: string, type?: string, durationMinutes?: number): Promise<boolean> => {
    try {
      const EVENT_TYPES = ['dust_storm', 'meteor_shower', 'anomaly_discovered', 'resource_vein', 'cold_wave', 'solar_flare'] as const
      const eventType = type || EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)]
      const res = await fetchWithAuth('/api/events', {
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

  return { events, loading, error, processing, refetch: fetchEvents, createEvent, processNow }
}
