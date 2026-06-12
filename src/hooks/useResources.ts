'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ResourceRow } from '@/domains/resource/resource.types'
import { useSubscription } from './useSubscription'

export function useResources(colonyId: string | null) {
  const [resources, setResources] = useState<ResourceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchResources = useCallback(async () => {
    if (!colonyId) return []
    const res = await fetch(`/api/resources?colonyId=${colonyId}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch resources')
    return data.resources ?? []
  }, [colonyId])

  useEffect(() => {
    if (!colonyId) return
    fetchResources()
      .then(data => { setResources(data); setError(null) })
      .catch(err => { console.error('useResources error:', err); setError(String(err)) })
      .finally(() => { if (mountedRef.current) setLoading(false) })
  }, [fetchResources, colonyId])
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  // Smooth client-side simulation between server updates
  useEffect(() => {
    if (resources.length === 0) return
    const interval = setInterval(() => {
      setResources(prev =>
        prev.map(r => ({ ...r, amount: r.amount + (r.production_rate - r.consumption_rate) / 720 }))
      )
    }, 5000)
    return () => clearInterval(interval)
  }, [resources.length])

  // Realtime: sync from server when resources recalculated
  useSubscription('resources', colonyId, (payload) => {
    if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
      const updated = payload.new as unknown as ResourceRow
      setResources(prev => {
        const idx = prev.findIndex(r => r.id === updated.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = updated
          return next
        }
        return [...prev, updated]
      })
    }
  })

  return { resources, loading, error, refetch: fetchResources }
}
