'use client'

import dynamic from 'next/dynamic'
import type { BattleTick, Obstacle, SimUnit, UnitRow } from '@/domains/combat/combat.types'

export interface SimulatorReplayData {
  attackerUnits: UnitRow[]
  defenderUnits: UnitRow[]
  logs: BattleTick[]
  winner: string
  initialState: SimUnit[]
  obstacles?: Obstacle[]
}

interface BattleReplayModalProps {
  attackerUnits: UnitRow[]
  defenderUnits: UnitRow[]
  initialState?: SimUnit[]
  obstacles?: Obstacle[]
  logs: BattleTick[]
  onClose: () => void
}

export const LazyBattleReplayModal = dynamic<BattleReplayModalProps>(
  () => import('@/components/game/BattleReplayModal').then(mod => mod.BattleReplayModal),
  {
    ssr: false,
    loading: () => null,
  },
)
