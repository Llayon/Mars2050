'use client'

import { memo } from 'react'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import type { Colony } from '@/domains/colony/colony.types'
import type { PopulationState } from '@/domains/population/population.types'
import { PopulationPanel } from '@/components/game/PopulationPanel'

interface ProfileScreenProps {
  colony: Colony | null
  colonyLoading: boolean
  userEmail?: string
  population?: PopulationState | null
  populationLoading?: boolean
  onUpgradePopulation?: (fromTier: string, count: number) => void
}

export const ProfileScreen = memo(function ProfileScreen({ 
  colony, 
  colonyLoading, 
  userEmail,
  population,
  populationLoading,
  onUpgradePopulation
}: ProfileScreenProps) {
  const { leaderboard, loading: lbLoading } = useLeaderboard()

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 pb-0">
        <h2 className="text-lg font-bold text-white">Профиль</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-24 space-y-3">
        <div className="glass-panel rounded-xl p-4">
          {colonyLoading ? (
            <div className="h-16 bg-gray-700/30 rounded-lg animate-pulse" />
          ) : colony ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-mars-red/30 flex items-center justify-center text-lg">
                  🚀
                </div>
                <div>
                  <p className="font-bold text-white">{colony.name}</p>
                  <p className="text-xs text-gray-400">Уровень {colony.level}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-black/20 rounded-lg p-2">
                  <p className="text-xl font-bold text-mars-gold">{colony.level}</p>
                  <p className="text-[10px] text-gray-500">Уровень</p>
                </div>
                <div className="bg-black/20 rounded-lg p-2">
                  <p className="text-xl font-bold text-white">{colony.experience}</p>
                  <p className="text-[10px] text-gray-500">Опыт</p>
                </div>
              </div>
              {userEmail && (
                <p className="text-xs text-gray-500 mt-3 truncate">{userEmail}</p>
              )}
            </>
          ) : (
            <p className="text-gray-400 text-sm">Нет данных</p>
          )}
        </div>

        {/* Population Panel */}
        <div className="glass-panel rounded-xl overflow-hidden">
          <PopulationPanel 
            population={population ?? null} 
            loading={populationLoading} 
            onUpgrade={onUpgradePopulation || (() => {})} 
          />
        </div>

        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-mars-border">
            <p className="font-semibold text-sm text-white">🏆 Рейтинг колоний</p>
          </div>

          {lbLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-8 bg-gray-700/30 rounded animate-pulse" />
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-gray-500 text-sm">Пока нет данных</p>
            </div>
          ) : (
            <div className="divide-y divide-mars-border/50">
              {leaderboard.slice(0, 10).map(entry => {
                const rankIcon = entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : null
                return (
                  <div key={entry.rank} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5">
                    <span className="w-6 text-center text-sm font-bold text-gray-400">
                      {rankIcon || entry.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{entry.colonyName}</p>
                      <p className="text-[10px] text-gray-500 truncate">{entry.playerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-mars-gold">{entry.score}</p>
                      <p className="text-[10px] text-gray-500">Ур. {entry.level}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
