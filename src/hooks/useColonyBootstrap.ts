'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import type { ColonyBootstrapPayload } from '@/domains/colony/colony.types'
import { clearBootstrapCache, readBootstrapCache, writeBootstrapCache } from '@/lib/bootstrap-cache'
import { fetchWithAuth } from '@/lib/fetch-with-auth'
import { LOAD_MILESTONE_EVENT, markLoadMilestone } from '@/lib/load-milestones'

function getColonyIdFromBootstrapUrl(url: string): string | null {
  try {
    return new URL(url, window.location.href).searchParams.get('colonyId')
  } catch {
    return null
  }
}

async function fetchBootstrap(url: string): Promise<ColonyBootstrapPayload> {
  markLoadMilestone('bootstrap-start')
  const colonyId = getColonyIdFromBootstrapUrl(url)
  try {
    const res = await fetchWithAuth(url, {}, { cookieFirst: true })
    const data = await res.json()
    if (!res.ok) {
      if ((res.status === 401 || res.status === 403) && colonyId) clearBootstrapCache(colonyId)
      throw new Error(data.error?.message || data.error || 'Failed to bootstrap colony')
    }
    if (colonyId) writeBootstrapCache(colonyId, data)
    return data
  } finally {
    markLoadMilestone('bootstrap-end')
    markLoadMilestone('fresh-bootstrap-end')
  }
}

function hasLoadMilestone(name: string): boolean {
  if (typeof performance === 'undefined') return false
  return performance.getEntriesByType('mark').some(entry => entry.name === `mars2050:load:${name}`)
}

function waitForFirstCanvas(): Promise<void> {
  if (typeof window === 'undefined' || hasLoadMilestone('first-canvas')) return Promise.resolve()
  return new Promise(resolve => {
    const onMilestone = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string }>).detail
      if (detail?.name !== 'first-canvas') return
      window.removeEventListener(LOAD_MILESTONE_EVENT, onMilestone)
      resolve()
    }
    window.addEventListener(LOAD_MILESTONE_EVENT, onMilestone)
  })
}

async function syncBootstrap(colonyId: string): Promise<ColonyBootstrapPayload> {
  markLoadMilestone('bootstrap-sync-start')
  try {
    const res = await fetchWithAuth('/api/colonies/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colonyId }),
    }, { cookieFirst: true })
    const data = await res.json()
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) clearBootstrapCache(colonyId)
      throw new Error(data.error?.message || data.error || 'Failed to sync colony')
    }
    writeBootstrapCache(colonyId, data)
    return data
  } finally {
    markLoadMilestone('bootstrap-sync-end')
  }
}

export function useColonyBootstrap(colonyId: string | null) {
  const cachedData = useMemo(() => colonyId ? readBootstrapCache(colonyId) : null, [colonyId])
  const [freshResolvedColonyId, setFreshResolvedColonyId] = useState<string | null>(null)
  const [syncResolvedColonyId, setSyncResolvedColonyId] = useState<string | null>(null)
  const [syncLoadingColonyId, setSyncLoadingColonyId] = useState<string | null>(null)

  useEffect(() => {
    if (cachedData) markLoadMilestone('cached-bootstrap-used')
  }, [cachedData])

  const { data, error, isLoading, isValidating, mutate } = useSWR<ColonyBootstrapPayload>(
    colonyId ? `/api/colonies/bootstrap?colonyId=${colonyId}` : null,
    fetchBootstrap,
    {
      fallbackData: cachedData ?? undefined,
      revalidateOnMount: true,
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 5000,
      onSuccess: () => setFreshResolvedColonyId(colonyId),
    }
  )

  useEffect(() => {
    if (!colonyId || !data || freshResolvedColonyId !== colonyId || syncResolvedColonyId === colonyId) return
    let cancelled = false
    async function runDeferredSync() {
      await waitForFirstCanvas()
      if (cancelled || !colonyId) return
      setSyncLoadingColonyId(colonyId)
      try {
        const synced = await syncBootstrap(colonyId)
        if (!cancelled) {
          setSyncResolvedColonyId(colonyId)
          void mutate(synced, false)
        }
      } catch {
        if (!cancelled) setSyncResolvedColonyId(colonyId)
      } finally {
        if (!cancelled) {
          setSyncLoadingColonyId(currentColonyId => currentColonyId === colonyId ? null : currentColonyId)
        }
      }
    }
    void runDeferredSync()
    return () => { cancelled = true }
  }, [colonyId, data, freshResolvedColonyId, syncResolvedColonyId, mutate])

  const hasCachedData = !!cachedData
  const syncLoading = syncLoadingColonyId === colonyId
  const freshLoading = (!!colonyId && isValidating && freshResolvedColonyId !== colonyId) || syncLoading
  const isStale = hasCachedData && freshResolvedColonyId !== colonyId

  return {
    data,
    loading: !data && isLoading,
    freshLoading,
    isStale,
    hasCachedData,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    refetch: mutate,
  }
}
