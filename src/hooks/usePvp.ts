'use client'

import { useState } from 'react'
import type { AttackResult, StoredBattleReplay, TradeResult } from '@/domains/pvp/pvp.types'
import { parseBattleReplayResponse } from '@/domains/pvp/pvp.replay-compat'
import type { DeploymentPoint } from '@/domains/combat/combat.deployment'

export function usePvp(colonyId: string | null) {
  const [attacking, setAttacking] = useState(false)
  const [trading, setTrading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0)

  async function attack(
    defenderColonyId: string,
    attackerUnitsPlacement?: DeploymentPoint[]
  ): Promise<AttackResult | null> {
    if (!colonyId) return null

    setAttacking(true)
    setError(null)

    try {
      const res = await fetch('/api/pvp/attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attackerColonyId: colonyId, defenderColonyId, attackerUnitsPlacement })
      })

      const data = await res.json()
      if (res.status === 429) {
        const detail = (data?.error?.detail?.cooldownRemaining as number) ?? 0
        setCooldownRemaining(detail)
        setError(data?.error?.message ?? 'Cooldown active')
        return null
      }
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Attack failed')
      setCooldownRemaining(0)
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
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Trade failed')
      return data
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      return null
    } finally {
      setTrading(false)
    }
  }

  async function fetchBattle(battleId: string): Promise<StoredBattleReplay> {
    const res = await fetch(`/api/pvp/battle/${battleId}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || data.error || 'Fetch failed')
    const replay = parseBattleReplayResponse(data)
    if (!replay) throw new Error('Invalid replay payload')
    return replay
  }

  return {
    attack,
    trade,
    fetchBattle,
    attacking,
    trading,
    error,
    cooldownRemaining,
  }
}
