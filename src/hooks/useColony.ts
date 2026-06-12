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
    if (!colonyId) return null
    const { data, error: fetchError } = await supabase
      .from('colonies')
      .select('*')
      .eq('id', colonyId)
      .single()
    if (fetchError) throw fetchError
    return data
  }, [colonyId])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!colonyId) return
    fetchColony()
      .then(data => { if (data) setColony(data); setError(null) })
      .catch(err => setError(String(err)))
      .finally(() => { if (mountedRef.current) setLoading(false) })
  }, [fetchColony, colonyId])

  return { colony, loading, error, refetch: fetchColony }
}
