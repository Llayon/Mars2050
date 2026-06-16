'use client'

import { useState, useEffect, useRef } from 'react'
import useSWR from 'swr'
import type { ResourceRow } from '@/domains/resource/resource.types'
import { useSubscription } from './useSubscription'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch resources')
  return data.resources ?? []
}

export function useResources(colonyId: string | null) {
  const { data: serverResources, mutate, error, isLoading } = useSWR<ResourceRow[]>(
    colonyId ? `/api/resources?colonyId=${colonyId}` : null,
    fetcher,
    { refreshInterval: 60000 }
  )

  const [displayResources, setDisplayResources] = useState<ResourceRow[]>([])
  const exactAmountsRef = useRef<Record<string, number>>({})

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
        const nextExact = currentExact + ratePerSec
        
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

  return { resources: displayResources, loading: isLoading, error, mutate, refetch: mutate }
}
