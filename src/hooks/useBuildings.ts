'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BUILDING_TYPES,
  BUILDING_PRODUCTION_MAP,
  BUILDING_RESOURCE_MAP
} from '@/domains/building/building.config'
import type { BuildingRow, BuildingTypeKey } from '@/domains/building/building.types'

/**
 * Hook for managing colony buildings.
 * Reads from Supabase (RLS-protected), mutates via API routes.
 */
export function useBuildings(colonyId: string | null) {
  const [buildings, setBuildings] = useState<BuildingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBuildings = useCallback(async () => {
    if (!colonyId) return

    try {
      const { data, error: fetchError } = await supabase
        .from('buildings')
        .select('*')
        .eq('colony_id', colonyId)
        .order('created_at', { ascending: true })

      if (fetchError) throw fetchError
      if (data) setBuildings(data)
      setError(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [colonyId])

  useEffect(() => {
    fetchBuildings()
  }, [fetchBuildings])

  /**
   * Creates a new building via API route (server-side mutation).
   * Updates resource production rates on the server.
   */
  const buildStructure = useCallback(async (type: BuildingTypeKey) => {
    if (!colonyId) return

    const config = BUILDING_TYPES[type]
    if (!config) throw new Error('Invalid building type')

    try {
      const res = await fetch('/api/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colonyId,
          type,
          name: config.name
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to build')
      }

      const { building } = await res.json()
      setBuildings(prev => [...prev, building])
      return building
    } catch (err) {
      setError(String(err))
      throw err
    }
  }, [colonyId])

  /**
   * Demolishes a building via API route.
   * Reverts resource production rates on the server.
   */
  const demolishBuilding = useCallback(async (buildingId: string) => {
    try {
      const res = await fetch(`/api/buildings?buildingId=${buildingId}&colonyId=${colonyId}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to demolish')
      }

      setBuildings(prev => prev.filter(b => b.id !== buildingId))
    } catch (err) {
      setError(String(err))
      throw err
    }
  }, [colonyId])

  return {
    buildings,
    loading,
    error,
    buildStructure,
    demolishBuilding,
    refetch: fetchBuildings
  }
}