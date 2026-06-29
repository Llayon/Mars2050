'use client'

import { memo } from 'react'
import { POPULATION_TIERS } from '@/domains/population/population.config'
import type { PopulationState, PopulationTier } from '@/domains/population/population.types'

interface PopulationSummaryProps {
  population: PopulationState | null
  loading?: boolean
}

const TIERS: PopulationTier[] = ['worker', 'technician', 'scientist', 'director']

export const PopulationSummary = memo(function PopulationSummary({ population, loading }: PopulationSummaryProps) {
  if (loading) {
    return (
      <div className="bg-gray-800 p-3 rounded-lg shadow-lg">
        <div className="h-5 w-32 bg-gray-700 rounded animate-pulse mb-3" />
        <div className="grid grid-cols-4 gap-2">
          {TIERS.map(tier => (
            <div key={tier} className="h-9 bg-gray-700/70 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!population) {
    return (
      <div className="bg-gray-800 p-3 rounded-lg shadow-lg">
        <h2 className="text-sm font-bold text-white">Население</h2>
        <p className="mt-1 text-xs text-gray-400">Нет данных</p>
      </div>
    )
  }

  const tierRows = TIERS.map(tier => {
    const count = population[`${tier}s` as keyof PopulationState] as number
    const happiness = population[`happiness_${tier}s` as keyof PopulationState] as number
    return { tier, count, happiness, config: POPULATION_TIERS[tier] }
  })
  const total = tierRows.reduce((sum, row) => sum + row.count, 0)
  const weightedHappiness = total > 0
    ? Math.round(tierRows.reduce((sum, row) => sum + row.happiness * row.count, 0) / total)
    : 0
  const happinessColor = weightedHappiness >= 70
    ? 'text-green-400'
    : weightedHappiness >= 40
      ? 'text-yellow-400'
      : 'text-red-400'
  const growthProgress = Math.max(0, Math.min(100, Math.round(population.growth_progress || 0)))

  return (
    <div className="bg-gray-800 p-3 rounded-lg shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white">Население</h2>
          <p className="text-xs text-gray-400">
            Всего: <span className="text-gray-100 font-semibold">{total.toLocaleString('ru-RU')}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Счастье</p>
          <p className={`text-sm font-bold ${happinessColor}`}>{weightedHappiness}%</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {tierRows.map(row => (
          <div key={row.tier} className="bg-gray-700/80 rounded-md px-2 py-1.5 text-center">
            <div className="text-base leading-none">{row.config.icon}</div>
            <div className="mt-1 text-xs font-semibold text-white tabular-nums">{row.count}</div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
          <span>Рост рабочих</span>
          <span>{growthProgress}%</span>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-cyan-400 transition-all" style={{ width: `${growthProgress}%` }} />
        </div>
      </div>
    </div>
  )
})
