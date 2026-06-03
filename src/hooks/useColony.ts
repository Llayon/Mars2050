'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Colony } from '@/domains/colony/colony.types'

export function useColony(colonyId: string | null) {
  const [colony, setColony] = useState<Colony | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchColony = useCallback(async () => {
    if (!colonyId) return

    try {
      const { data, error: fetchError } = await supabase
        .from('colonies')
        .select('*')
        .eq('id', colonyId)
        .single()

      if (fetchError) throw fetchError
      if (mountedRef.current) setColony(data)
      if (mountedRef.current) setError(null)
    } catch (err) {
      if (mountedRef.current) setError(String(err))
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [colonyId])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    fetchColony()
  }, [fetchColony])

  return { colony, loading, error, refetch: fetchColony }
}
