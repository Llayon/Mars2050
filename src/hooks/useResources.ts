'use client'

import { useState, useEffect, useRef } from 'react'
import useSWR from 'swr'
import type { ResourceRow } from '@/domains/resource/resource.types'
import { useSubscription } from './useSubscription'
import { fetchWithAuth } from '@/lib/fetch-with-auth'

function finiteNumber(value: unknown, fallback = 0): number {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

function normalizeResource(resource: ResourceRow): ResourceRow {
  const amount = finiteNumber(resource.amount)
  const productionRate = finiteNumber(resource.production_rate)
  const consumptionRate = finiteNumber(resource.consumption_rate)
  const capacity = Math.max(amount, finiteNumber(resource.capacity, amount))

  return {
    ...resource,
    amount,
    capacity,
    production_rate: productionRate,
    consumption_rate: consumptionRate,
  }
}

const fetcher = async (url: string) => {
  const res = await fetchWithAuth(url)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || data.error || 'Failed to fetch resources')
  return (data.resources ?? []).map(normalizeResource)
}

interface UseResourcesOptions {
  initialData?: ResourceRow[]
  enabled?: boolean
}

export function useResources(colonyId: string | null, options: UseResourcesOptions = {}) {
  const enabled = options.enabled ?? true
  const { data: serverResources, mutate, error, isLoading } = useSWR<ResourceRow[]>(
    colonyId ? `/api/resources?colonyId=${colonyId}` : null,
    fetcher,
    {
      revalidateOnMount: false,
      revalidateOnFocus: false,
    }
  )

  const [displayResources, setDisplayResources] = useState<ResourceRow[]>([])
  const exactAmountsRef = useRef<Record<string, number>>({})

  useEffect(() => {
    if (options.initialData) {
      void mutate(options.initialData.map(normalizeResource), false)
    }
  }, [options.initialData, mutate])

  useEffect(() => {
    if (enabled && colonyId) {
      void mutate()
    }
  }, [enabled, colonyId, mutate])

  useEffect(() => {
    if (serverResources) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayResources(serverResources.map(r => ({ ...r, amount: Math.floor(r.amount) })))
      const newExact: Record<string, number> = {}
      serverResources.forEach(r => {
        newExact[r.type] = r.amount
      })
      exactAmountsRef.current = newExact
    }
  }, [serverResources])

  useEffect(() => {
    if (!serverResources || serverResources.length === 0) return
    const timer = setInterval(() => {
      let hasChanges = false

      serverResources.forEach(r => {
        const netRatePerHour = r.production_rate - r.consumption_rate
        if (netRatePerHour === 0) return
        const ratePerSec = netRatePerHour / 3600
        const currentExact = exactAmountsRef.current[r.type] ?? r.amount
        const nextExact = Math.max(0, Math.min(r.capacity, currentExact + ratePerSec))
        
        if (Math.floor(nextExact) !== Math.floor(currentExact)) {
          hasChanges = true
        }
        exactAmountsRef.current[r.type] = nextExact
      })

      if (hasChanges) {
        setDisplayResources(prev => prev.map(r => {
          const currentExact = exactAmountsRef.current[r.type]
          if (currentExact !== undefined && Math.floor(currentExact) !== r.amount) {
            return { ...r, amount: Math.floor(currentExact) }
          }
          return r
        }))
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [serverResources])

  useSubscription('resources', colonyId, () => { mutate() })

  const loading = Boolean(colonyId && enabled && !serverResources && !error) || isLoading

  return { resources: displayResources, loading, error, mutate, refetch: mutate }
}
