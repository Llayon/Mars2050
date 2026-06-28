import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { PopulationState } from '@/domains/population/population.types'
import type { UpgradePopulationDto } from '@/domains/population/population.schemas'

export function usePopulation(colonyId: string | null) {
  const [population, setPopulation] = useState<PopulationState | null>(null)
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
    if (!colonyId) return

    const loadTimer = setTimeout(() => {
      void fetchPopulation()
    }, 0)

    // Realtime subscription
    const channel = supabase.channel(`population-${colonyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'population', filter: `colony_id=eq.${colonyId}` },
        (payload) => {
          setPopulation(payload.new as PopulationState)
        }
      )
      .subscribe()

    return () => {
      clearTimeout(loadTimer)
      supabase.removeChannel(channel)
    }
  }, [colonyId, fetchPopulation])

  const upgradeTier = async (fromTier: UpgradePopulationDto['fromTier'], count: number) => {
    if (!colonyId) return

    const res = await fetch('/api/population/upgrade', {
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
