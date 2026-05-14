'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  const mountedRef = useRef(true)

  const fetchResources = useCallback(async () => {
    if (!colonyId) return

    try {
      const res = await fetch(`/api/resources?colonyId=${colonyId}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch resources')
      }

      if (mountedRef.current && data.resources) {
        setResources(data.resources)
      }
      if (mountedRef.current) setError(null)
    } catch (err) {
      if (mountedRef.current) {
        console.error('useResources error:', err)
        setError(String(err))
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [colonyId])

  useEffect(() => {
    fetchResources()
  }, [fetchResources])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

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

    const dbRefresh = setInterval(fetchResources, 60000)

    return () => {
      clearInterval(interval)
      clearInterval(dbRefresh)
    }
  }, [fetchResources, resources.length])

  return { resources, loading, error, refetch: fetchResources }
}
