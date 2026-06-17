'use client'

import { memo, useState } from 'react'

interface Tab {
  id: string
  label: string
  icon: string
}

const TABS: Tab[] = [
  { id: 'resources', label: 'Ресурсы', icon: '📦' },
  { id: 'buildings', label: 'Стройка', icon: '🏗' },
  { id: 'army', label: 'Армия', icon: '🛡️' },
  { id: 'map', label: 'Карта', icon: '🗺' },
  { id: 'events', label: 'События', icon: '⚠️' },
  { id: 'pvp', label: 'PvP', icon: '⚔️' },
  { id: 'leaderboard', label: 'Рейтинг', icon: '🏆' },
]

interface GameTabsProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export const GameTabs = memo(function GameTabs({ activeTab, onTabChange }: GameTabsProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
      <div className="flex overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex flex-col items-center py-2 px-1 min-w-0 text-xs transition-colors ${
              activeTab === tab.id
                ? 'text-blue-400 border-t-2 border-blue-400 bg-gray-700'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span className="mt-0.5 truncate w-full text-center">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
})
