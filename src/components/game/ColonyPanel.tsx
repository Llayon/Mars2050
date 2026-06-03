'use client'

import { memo } from 'react'
import type { Colony } from '@/domains/colony/colony.types'

interface ColonyPanelProps {
  colony: Colony | null
  loading: boolean
}

export const ColonyPanel = memo(function ColonyPanel({ colony, loading }: ColonyPanelProps) {
  if (loading) return <div className="h-16 bg-gray-800 rounded-lg animate-pulse" />
  if (!colony) return null

  const expToNext = (colony.level + 1) * 100
  const expProgress = Math.min((colony.experience / expToNext) * 100, 100)

  return (
    <div className="bg-gray-800 p-3 rounded-lg shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">{colony.name}</h2>
          <p className="text-sm text-gray-400">Уровень {colony.level}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Опыт</p>
          <p className="text-sm font-semibold text-yellow-400">{colony.experience}/{expToNext}</p>
        </div>
      </div>
      <div className="mt-2 w-full bg-gray-700 rounded-full h-1.5">
        <div className="bg-yellow-500 h-1.5 rounded-full transition-all" style={{ width: `${expProgress}%` }} />
      </div>
    </div>
  )
})
