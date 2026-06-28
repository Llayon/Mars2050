import React from 'react'
import { POPULATION_TIERS } from '@/domains/population/population.config'
import type { PopulationState } from '@/domains/population/population.types'

interface PopulationPanelProps {
  population: PopulationState | null
  onUpgrade: (fromTier: string, count: number) => void
  loading?: boolean
}

export function PopulationPanel({ population, onUpgrade, loading }: PopulationPanelProps) {
  if (!population) {
    return (
      <div className="bg-transparent text-white">
        <div className="px-4 py-3 border-b border-mars-border">
          <h3 className="font-semibold text-sm text-white">👥 Население</h3>
        </div>
        <div className="p-4">Нет данных...</div>
      </div>
    )
  }

  const tiers = [
    { key: 'worker', count: population.workers, hap: population.happiness_workers },
    { key: 'technician', count: population.technicians, hap: population.happiness_technicians },
    { key: 'scientist', count: population.scientists, hap: population.happiness_scientists },
    { key: 'director', count: population.directors, hap: population.happiness_directors }
  ]

  return (
    <div className="bg-transparent text-white">
      <div className="px-4 py-3 border-b border-mars-border">
        <h3 className="font-semibold text-sm text-white">👥 Население</h3>
      </div>
      <div className="space-y-4 p-4">
        {tiers.map((tier, idx) => {
          const config = POPULATION_TIERS[tier.key as keyof typeof POPULATION_TIERS]
          const isLocked = tier.count === 0 && tier.key !== 'worker' // worker is never locked

          return (
            <div key={tier.key} className={`flex items-center justify-between p-3 rounded-lg ${isLocked ? 'bg-gray-800/50 opacity-50' : 'bg-gray-800'}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{config.icon}</span>
                <div>
                  <h4 className="font-medium text-gray-200">{config.name}</h4>
                  <p className="text-sm text-gray-400">Количество: {tier.count}</p>
                </div>
              </div>
              
              {!isLocked && (
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-400 mb-1">Счастье</p>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${tier.hap >= 70 ? 'bg-green-500' : tier.hap >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${tier.hap}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-300 w-8">{tier.hap}%</span>
                    </div>
                  </div>

                  {/* Only allow upgrade if next tier exists and there's enough population */}
                  {idx < tiers.length - 1 && tier.count >= 10 && (
                    <button 
                      onClick={() => onUpgrade(tier.key, 10)}
                      disabled={loading || tier.count < 10}
                      className="ml-2 px-3 py-1 bg-mars-orange hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded text-xs font-bold transition-colors"
                    >
                      Улучшить (10)
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
