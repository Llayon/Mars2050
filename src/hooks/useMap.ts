'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { MapLocation } from '@/domains/map/map.types'
import { EXPLORATION_COST } from '@/domains/map/map.config'

/**
 * Hook for fetching and managing map locations.
 * Uses Supabase client for reads (RLS-protected).
 */
export function useMap() {
  const [locations, setLocations] = useState<MapLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMap = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('map_locations')
        .select('*')
        .order('y', { ascending: true })

      if (fetchError) throw fetchError
      if (data) setLocations(data)
      setError(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMap()
  }, [fetchMap])

  /**
   * Discovers a map location via API route (server-side mutation).
   * Returns rewards info on success.
   */
  const discoverLocation = useCallback(async (locationId: string, colonyId: string) => {
    try {
      const res = await fetch('/api/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, colonyId })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to discover location')
      }

      // Update local state
      setLocations(prev =>
        prev.map(l => l.id === locationId ? { ...l, is_discovered: true } : l)
      )

      return data
    } catch (err) {
      setError(String(err))
      throw err
    }
  }, [])

  return { locations, loading, error, discoverLocation, refetch: fetchMap }
}

/** Get exploration cost for a location by difficulty. */
export function getExplorationCost(difficulty: number): Record<string, number> {
  return EXPLORATION_COST[difficulty] || EXPLORATION_COST[1]
}