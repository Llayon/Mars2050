'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BUILDING_TYPES } from '@/domains/building/building.config'
import type { BuildingRow, BuildingTypeKey } from '@/domains/building/building.types'
import { useSubscription } from './useSubscription'

export function useBuildings(colonyId: string | null) {
  const [buildings, setBuildings] = useState<BuildingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBuildings = useCallback(async () => {
    if (!colonyId) return []
    const { data, error: fetchError } = await supabase
      .from('buildings')
      .select('*')
      .eq('colony_id', colonyId)
      .order('created_at', { ascending: true })
    if (fetchError) throw fetchError
    return data ?? []
  }, [colonyId])

  useEffect(() => {
    if (!colonyId) return
    fetchBuildings()
      .then(data => { setBuildings(data); setError(null) })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [fetchBuildings, colonyId])

  // Realtime: sync buildings on INSERT/UPDATE/DELETE
  useSubscription('buildings', colonyId, (payload) => {
    const building = payload.new as unknown as BuildingRow
    if (payload.eventType === 'INSERT') {
      setBuildings(prev => prev.some(b => b.id === building.id) ? prev : [...prev, building])
    } else if (payload.eventType === 'UPDATE') {
      setBuildings(prev => prev.map(b => b.id === building.id ? building : b))
    } else if (payload.eventType === 'DELETE') {
      setBuildings(prev => prev.filter(b => b.id !== payload.old.id))
    }
  })

  const buildStructure = useCallback(async (type: BuildingTypeKey, x?: number, y?: number) => {
    if (!colonyId) return
    const config = BUILDING_TYPES[type]
    if (!config) throw new Error('Invalid building type')
    try {
      const res = await fetch('/api/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colonyId, type, name: config.name, x: x ?? 10, y: y ?? 10 })
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

  const demolishBuilding = useCallback(async (buildingId: string) => {
    try {
      const res = await fetch(`/api/buildings?buildingId=${buildingId}&colonyId=${colonyId}`, { method: 'DELETE' })
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

  return { buildings, loading, error, buildStructure, demolishBuilding, refetch: fetchBuildings }
}
