'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BUILDING_TYPES } from '@/domains/building/building.config'
import type { BuildingRow, BuildingSettingsUpdate, BuildingTypeKey } from '@/domains/building/building.types'
import { useSubscription } from './useSubscription'
import { fetchWithAuth } from '@/lib/fetch-with-auth'

interface UseBuildingsOptions {
  initialData?: BuildingRow[]
  enabled?: boolean
}

export function useBuildings(colonyId: string | null, options: UseBuildingsOptions = {}) {
  const enabled = options.enabled ?? true
  const [buildings, setBuildings] = useState<BuildingRow[]>(options.initialData ?? [])
  const [loading, setLoading] = useState(Boolean(colonyId && enabled && !options.initialData))
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
    if (options.initialData) {
      setBuildings(options.initialData)
      setLoading(false)
      setError(null)
    }
  }, [options.initialData])

  useEffect(() => {
    if (!colonyId || !enabled) return
    setLoading(true)
    fetchBuildings()
      .then(data => { setBuildings(data); setError(null) })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [fetchBuildings, colonyId, enabled])

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
    if (!colonyId) throw new Error('No colony active')
    try {
      const res = await fetchWithAuth('/api/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colonyId, type, name: config.name, x: x ?? 10, y: y ?? 10 })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to build')
      }
      const building = data.building
      if (building) {
        setBuildings(prev => prev.some(b => b.id === building.id) ? prev : [...prev, building])
      }
      return building
    } catch (err) {
      setError(String(err))
      throw err
    }
  }, [colonyId])

  const demolishBuilding = useCallback(async (buildingId: string) => {
    if (!colonyId) throw new Error('No colony active')
    try {
      const res = await fetchWithAuth(`/api/buildings?buildingId=${buildingId}&colonyId=${colonyId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || data.error || 'Failed to demolish')
      }
      setBuildings(prev => prev.filter(b => b.id !== buildingId))
    } catch (err) {
      setError(String(err))
      throw err
    }
  }, [colonyId])

  const updateBuildingSettings = useCallback(async (buildingId: string, settings: BuildingSettingsUpdate) => {
    if (!colonyId) throw new Error('No colony active')
    let previousBuildings: BuildingRow[] = []
    setBuildings(prev => {
      previousBuildings = prev
      return prev.map(b => b.id === buildingId ? { ...b, ...settings } : b)
    })

    try {
      const payload = { colonyId, buildingId, ...settings }
      const res = await fetchWithAuth('/api/buildings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || data.error || 'Failed to update settings')
      }
    } catch (err) {
      setBuildings(previousBuildings)
      setError(String(err))
      throw err
    }
  }, [colonyId])

  return { buildings, loading, error, buildStructure, demolishBuilding, updateBuildingSettings, refetch: fetchBuildings }
}
