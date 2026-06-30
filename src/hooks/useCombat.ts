import useSWR from 'swr'
import { supabase } from '@/lib/supabase'
import type { UnitRow, UnitTypeKey } from '@/domains/combat/combat.types'
import { fetchWithAuth } from '@/lib/fetch-with-auth'

/**
 * Hook for managing the colony's army (hiring, dismissing, fetching).
 */
export function useCombat(colonyId: string | null) {
  const fetcher = async () => {
    if (!colonyId) return []
    const res = await fetchWithAuth(`/api/combat/units?colonyId=${colonyId}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch units')
    return data.units as UnitRow[]
  }

  const { data: units, error, mutate, isLoading } = useSWR<UnitRow[]>(
    colonyId ? `/api/combat/units?colonyId=${colonyId}` : null,
    fetcher
  )

  const hireUnit = async (unitType: UnitTypeKey) => {
    if (!colonyId) throw new Error('No colony active')
    try {
      const res = await fetchWithAuth('/api/combat/hire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colonyId, unitType })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Failed to hire')
      await mutate()
      return { success: true }
    } catch (e: unknown) {
      return { error: (e as Error).message }
    }
  }

  const dismissUnit = async (unitId: string) => {
    if (!colonyId) throw new Error('No colony active')
    try {
      const res = await fetchWithAuth('/api/combat/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colonyId, unitId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Failed to dismiss')
      await mutate()
      return { success: true }
    } catch (e: unknown) {
      return { error: (e as Error).message }
    }
  }

  const saveGarrison = async (units: { unitId: string, x: number, y: number }[]) => {
    if (!colonyId) throw new Error('No colony active')
    try {
      const res = await fetchWithAuth('/api/combat/garrison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colonyId, units })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Failed to save garrison')
      await mutate()
      return { success: true }
    } catch (e: unknown) {
      return { error: (e as Error).message }
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
