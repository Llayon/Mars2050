'use client'

import { useState } from 'react'
import type { AttackResult, TradeResult } from '@/domains/pvp/pvp.types'

export function usePvp(colonyId: string | null) {
  const [attacking, setAttacking] = useState(false)
  const [trading, setTrading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function attack(defenderColonyId: string): Promise<AttackResult | null> {
    if (!colonyId) return null

    setAttacking(true)
    setError(null)

    try {
      const res = await fetch('/api/pvp/attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attackerColonyId: colonyId, defenderColonyId })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Attack failed')
      return data
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      return null
    } finally {
      setAttacking(false)
    }
  }

  async function trade(
    toColonyId: string,
    offerResources: Record<string, number>,
    requestResources?: Record<string, number>
  ): Promise<TradeResult | null> {
    if (!colonyId) return null

    setTrading(true)
    setError(null)

    try {
      const res = await fetch('/api/pvp/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromColonyId: colonyId, toColonyId, offerResources, requestResources })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Trade failed')
      return data
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      return null
    } finally {
      setTrading(false)
    }
  }

  return { attack, trade, attacking, trading, error }
}
