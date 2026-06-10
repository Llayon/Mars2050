'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { LeaderboardEntry } from '@/domains/leaderboard/leaderboard.types'

export function useLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchLeaderboard = useCallback(async () => {
    const res = await fetch('/api/leaderboard')
    if (!res.ok) throw new Error('Failed to fetch leaderboard')
    const data = await res.json()
    return data.leaderboard ?? []
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    fetchLeaderboard()
      .then(data => { setLeaderboard(data); setError(null) })
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => { if (mountedRef.current) setLoading(false) })
  }, [fetchLeaderboard])

  return { leaderboard, loading, error, refetch: fetchLeaderboard }
}
