'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import type { ColonyBootstrapPayload } from '@/domains/colony/colony.types'
import { clearBootstrapCache, readBootstrapCache, writeBootstrapCache } from '@/lib/bootstrap-cache'
import { fetchWithAuth } from '@/lib/fetch-with-auth'
import { markLoadMilestone } from '@/lib/load-milestones'

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

export function useColonyBootstrap(colonyId: string | null) {
  const cachedData = useMemo(() => colonyId ? readBootstrapCache(colonyId) : null, [colonyId])
  const [freshResolvedColonyId, setFreshResolvedColonyId] = useState<string | null>(null)

  useEffect(() => {
    setFreshResolvedColonyId(null)
  }, [colonyId])

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
  const hasCachedData = !!cachedData
  const freshLoading = !!colonyId && isValidating && freshResolvedColonyId !== colonyId
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
