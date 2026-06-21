import useSWR from 'swr'
import { supabase } from '@/lib/supabase'
import type { UnitRow, UnitTypeKey } from '@/domains/combat/combat.types'

/**
 * Hook for managing the colony's army (hiring, dismissing, fetching).
 */
export function useCombat(colonyId: string | null) {
  const fetcher = async () => {
    if (!colonyId) return []
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('colony_id', colonyId)
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)
    return data as UnitRow[]
  }

  const { data: units, error, mutate } = useSWR(
    colonyId ? `combat-units-${colonyId}` : null,
    fetcher
  )

  const hireUnit = async (unitType: UnitTypeKey) => {
    if (!colonyId) return { error: 'No colony ID' }
    try {
      const res = await fetch('/api/combat/hire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colonyId, unitType })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Failed to hire')
      await mutate()
      return { success: true }
    } catch (e: any) {
      return { error: e.message }
    }
  }

  const dismissUnit = async (unitId: string) => {
    if (!colonyId) return { error: 'No colony ID' }
    try {
      const res = await fetch('/api/combat/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colonyId, unitId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Failed to dismiss')
      await mutate()
      return { success: true }
    } catch (e: any) {
      return { error: e.message }
    }
  }

  const saveGarrison = async (units: { unitId: string, x: number, y: number }[]) => {
    if (!colonyId) return { error: 'No colony ID' }
    try {
      const res = await fetch('/api/combat/garrison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colonyId, units })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Failed to save garrison')
      await mutate()
      return { success: true }
    } catch (e: any) {
      return { error: e.message }
    }
  }

  return {
    units: units || [],
    isLoading: !error && !units,
    isError: error,
    hireUnit,
    dismissUnit,
    saveGarrison,
    refetch: mutate
  }
}
