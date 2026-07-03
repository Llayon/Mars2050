'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Colony } from '@/domains/colony/colony.types'

interface UseColonyOptions {
  initialData?: Colony | null
  enabled?: boolean
}

export function useColony(colonyId: string | null, options: UseColonyOptions = {}) {
  const enabled = options.enabled ?? true
  const [colony, setColony] = useState<Colony | null>(options.initialData ?? null)
  const [loading, setLoading] = useState(Boolean(colonyId && enabled && !options.initialData))
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
    if (options.initialData !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setColony(options.initialData)
      setLoading(false)
      setError(null)
    }
  }, [options.initialData])

  useEffect(() => {
    if (!colonyId || !enabled) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetchColony()
      .then(data => { if (data) setColony(data); setError(null) })
      .catch(err => setError(String(err)))
      .finally(() => { if (mountedRef.current) setLoading(false) })
  }, [fetchColony, colonyId, enabled])

  return { colony, loading, error, refetch: fetchColony }
}
