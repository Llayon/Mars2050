import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { PopulationState } from '@/domains/population/population.types'
import type { UpgradePopulationDto } from '@/domains/population/population.schemas'
import { fetchWithAuth } from '@/lib/fetch-with-auth'
import { useSubscription } from './useSubscription'

interface UsePopulationOptions {
  initialData?: PopulationState | null
  enabled?: boolean
}

export function usePopulation(colonyId: string | null, options: UsePopulationOptions = {}) {
  const enabled = options.enabled ?? true
  const [population, setPopulation] = useState<PopulationState | null>(options.initialData ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPopulation = useCallback(async () => {
    if (!colonyId) return
    setLoading(true)
    setError(null)
    
    const { data, error: fetchError } = await supabase
      .from('population')
      .select('*')
      .eq('colony_id', colonyId)
      .single()

    if (fetchError) {
      setError(fetchError.message)
    } else if (data) {
      setPopulation(data as PopulationState)
    }
    setLoading(false)
  }, [colonyId])

  useEffect(() => {
    if (options.initialData !== undefined) {
      setPopulation(options.initialData)
      setLoading(false)
      setError(null)
    }
  }, [options.initialData])

  useEffect(() => {
    if (!colonyId || !enabled) return

    const loadTimer = setTimeout(() => {
      void fetchPopulation()
    }, 0)

    return () => {
      clearTimeout(loadTimer)
    }
  }, [colonyId, fetchPopulation, enabled])

  useSubscription('population', colonyId, (payload) => {
    setPopulation(payload.new as unknown as PopulationState)
  })

  const upgradeTier = async (fromTier: UpgradePopulationDto['fromTier'], count: number) => {
    if (!colonyId) return

    const res = await fetchWithAuth('/api/population/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colonyId, fromTier, count })
    })

    const result = await res.json()
    if (!res.ok) {
      throw new Error(result.error?.message || 'Failed to upgrade population')
    }
  }

  return { population, loading, error, fetchPopulation, upgradeTier }
}
