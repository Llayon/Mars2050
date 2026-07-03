'use client'

import { useCallback, useEffect, useState } from 'react'
import type { EconomyDebugBreakdown } from '@/domains/resource/resource.debug'
import { fetchWithAuth } from '@/lib/fetch-with-auth'

interface EconomyDebugResponse {
  breakdown?: EconomyDebugBreakdown
  error?: { message?: string } | string
}

function apiMessage(data: EconomyDebugResponse, fallback: string): string {
  if (typeof data.error === 'string') return data.error
  return data.error?.message || fallback
}

export function useEconomyDebug(colonyId: string | null) {
  const [breakdown, setBreakdown] = useState<EconomyDebugBreakdown | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!colonyId) return null
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWithAuth(`/api/resources/debug?colonyId=${colonyId}`)
      const data = await res.json() as EconomyDebugResponse
      if (!res.ok) throw new Error(apiMessage(data, 'Failed to load economy debug'))
      setBreakdown(data.breakdown || null)
      return data.breakdown || null
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [colonyId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch()
  }, [refetch])

  return { breakdown, loading, error, refetch }
}
