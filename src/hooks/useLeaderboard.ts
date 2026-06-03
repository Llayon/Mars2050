'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { LeaderboardEntry } from '@/domains/leaderboard/leaderboard.types'

export function useLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard')
      if (!res.ok) throw new Error('Failed to fetch leaderboard')
      const data = await res.json()
      if (mountedRef.current) setLeaderboard(data.leaderboard ?? [])
      if (mountedRef.current) setError(null)
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  return { leaderboard, loading, error, refetch: fetchLeaderboard }
}
