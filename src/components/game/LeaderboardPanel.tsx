'use client'

import { memo } from 'react'
import { useLeaderboard } from '@/hooks/useLeaderboard'

export const LeaderboardPanel = memo(function LeaderboardPanel() {
  const { leaderboard, loading } = useLeaderboard()

  if (loading) return <div className="p-4 text-gray-400 bg-gray-800 rounded-lg">Загрузка рейтинга...</div>

  return (
    <div className="bg-gray-800 text-white p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4">🏆 Рейтинг колоний</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-600">
              <th className="text-left p-2">#</th>
              <th className="text-left p-2">Колония</th>
              <th className="text-left p-2">Игрок</th>
              <th className="text-center p-2">Ур.</th>
              <th className="text-right p-2">Очки</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry) => (
              <tr key={entry.rank} className="border-b border-gray-700 hover:bg-gray-700">
                <td className="p-2 font-bold">
                  {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
                </td>
                <td className="p-2">{entry.colonyName}</td>
                <td className="p-2 text-gray-300">{entry.playerName}</td>
                <td className="p-2 text-center">{entry.level}</td>
                <td className="p-2 text-right font-semibold">{entry.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {leaderboard.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-4">
          Пока нет данных для рейтинга
        </p>
      )}
    </div>
  )
})
