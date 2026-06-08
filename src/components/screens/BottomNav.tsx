'use client'

import { memo } from 'react'

export type TabId = 'colony' | 'buildings' | 'map' | 'operations' | 'profile'

interface TabDef {
  id: TabId
  label: string
  icon: string
}

const TABS: TabDef[] = [
  { id: 'colony', label: 'Колония', icon: '🏠' },
  { id: 'buildings', label: 'Стройка', icon: '🏗' },
  { id: 'map', label: 'Карта', icon: '🗺' },
  { id: 'operations', label: 'Операции', icon: '⚔️' },
  { id: 'profile', label: 'Профиль', icon: '👤' },
]

interface BottomNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export const BottomNav = memo(function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="glass-panel-light rounded-t-2xl border-b-0 border-t border-mars-border">
        <div className="flex items-center justify-around px-2 py-1">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center py-2 px-3 min-w-0 transition-all duration-200 rounded-xl ${
                  isActive
                    ? 'text-mars-orange scale-110'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="text-xl leading-none">{tab.icon}</span>
                <span className={`text-[10px] mt-1 font-medium ${
                  isActive ? 'opacity-100' : 'opacity-70'
                }`}>
                  {tab.label}
                </span>
                {isActive && (
                  <span className="absolute -top-0.5 w-6 h-0.5 bg-mars-orange rounded-full glow-active" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
})
