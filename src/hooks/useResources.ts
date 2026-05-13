'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ResourceRow } from '@/domains/resource/resource.types'

/**
 * Hook for managing colony resources.
 * Uses API route for reads (with lazy recalculation on server).
 * Simulates production growth between server refreshes.
 */
export function useResources(colonyId: string | null) {
  const [resources, setResources] = useState<ResourceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchResources = useCallback(async () => {
    if (!colonyId) return

    try {
      const res = await fetch(`/api/resources?colonyId=${colonyId}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch resources')
      }

      if (data.resources) {
        setResources(data.resources)
      }
      setError(null)
    } catch (err) {
      console.error('useResources error:', err)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [colonyId])

  useEffect(() => {
    fetchResources()
  }, [fetchResources])

  // Simulate production growth between server refreshes
  useEffect(() => {
    if (resources.length === 0) return

    const interval = setInterval(() => {
      setResources(prev =>
        prev.map(r => ({
          ...r,
          amount: r.amount + (r.production_rate - r.consumption_rate) / 720
        }))
      )
    }, 5000)

    // Full refresh from server every 60 seconds
    const dbRefresh = setInterval(fetchResources, 60000)

    return () => {
      clearInterval(interval)
      clearInterval(dbRefresh)
    }
  }, [fetchResources, resources.length])

  return { resources, loading, error, refetch: fetchResources }
}