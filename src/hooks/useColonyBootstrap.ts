'use client'

import useSWR from 'swr'
import type { ColonyBootstrapPayload } from '@/domains/colony/colony.types'
import { fetchWithAuth } from '@/lib/fetch-with-auth'

async function fetchBootstrap(url: string): Promise<ColonyBootstrapPayload> {
  const res = await fetchWithAuth(url)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || data.error || 'Failed to bootstrap colony')
  return data
}

export function useColonyBootstrap(colonyId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ColonyBootstrapPayload>(
    colonyId ? `/api/colonies/bootstrap?colonyId=${colonyId}` : null,
    fetchBootstrap,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 5000,
    }
  )

  return {
    data,
    loading: isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    refetch: mutate,
  }
}
