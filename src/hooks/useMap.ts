'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { MapLocation } from '@/domains/map/map.types'
import { EXPLORATION_COST } from '@/domains/map/map.config'
import { useSubscription } from './useSubscription'
import { fetchWithAuth } from '@/lib/fetch-with-auth'

export function useMap() {
  const [locations, setLocations] = useState<MapLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMap = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('map_locations')
      .select('*')
      .order('y', { ascending: true })
    if (fetchError) throw fetchError
    return data ?? []
  }, [])

  useEffect(() => {
    fetchMap()
      .then(data => { setLocations(data); setError(null) })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [fetchMap])

  // Realtime: sync map location changes (e.g., discovered by other players, or self)
  useSubscription('map_locations', null, (payload) => {
    const location = payload.new as unknown as MapLocation
    if (payload.eventType === 'UPDATE') {
      setLocations(prev => prev.map(l => l.id === location.id ? location : l))
    } else if (payload.eventType === 'INSERT') {
      setLocations(prev => prev.some(l => l.id === location.id) ? prev : [...prev, location])
    } else if (payload.eventType === 'DELETE') {
      setLocations(prev => prev.filter(l => l.id !== payload.old.id))
    }
  })

  const discoverLocation = useCallback(async (locationId: string, colonyId: string) => {
    try {
      setLoading(true)
      const res = await fetchWithAuth('/api/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, colonyId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Failed to discover location')
      setLocations(prev => prev.map(l => l.id === locationId ? { ...l, is_discovered: true } : l))
      return data
    } catch (err) {
      setError(String(err))
      throw err
    }
  }, [])

  return { locations, loading, error, discoverLocation, refetch: fetchMap }
}

export function getExplorationCost(difficulty: number): Record<string, number> {
  return EXPLORATION_COST[difficulty] || EXPLORATION_COST[1]
}
