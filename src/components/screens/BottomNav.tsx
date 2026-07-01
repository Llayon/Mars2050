'use client'

import { memo } from 'react'

export type TabId = 'colony' | 'buildings' | 'population' | 'map' | 'operations' | 'profile'

interface TabDef {
  id: TabId
  label: string
  icon: React.ReactNode
}

const TABS: TabDef[] = [
  { id: 'colony', label: 'База', icon: <span className="w-3 h-3 bg-current rounded-full shadow-[0_0_8px_currentColor]" /> },
  { id: 'map', label: 'Карта', icon: <span className="w-3 h-3 bg-current rotate-45 shadow-[0_0_8px_currentColor]" /> },
  { id: 'operations', label: 'Армия', icon: <span className="w-3 h-3 border-t-2 border-r-2 border-current rotate-45" /> },
  { id: 'buildings', label: 'Стройка', icon: <span className="w-3 h-3 border-2 border-current" /> },
  { id: 'population', label: 'Люди', icon: <span className="w-3 h-3 border-l-2 border-r-2 border-t-2 border-current rounded-t" /> },
  { id: 'profile', label: 'Данные', icon: <span className="w-3 h-3 border border-current rounded-full flex items-center justify-center"><span className="w-1 h-1 bg-current rounded-full" /></span> },
]

interface BottomNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export const BottomNav = memo(function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="bg-gray-900/90 backdrop-blur-xl border-t border-gray-700/80 rounded-t-3xl shadow-[0_-5px_30px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-around px-2 py-2">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex flex-col items-center py-2 px-3 min-w-0 transition-all duration-200 rounded-xl active:scale-95 ${
                  isActive
                    ? 'text-cyan-400 bg-cyan-900/20'
                    : 'text-gray-500 hover:text-cyan-200 hover:bg-gray-800/50'
                }`}
              >
                <span className={`text-xl leading-none transition-transform duration-300 flex items-center justify-center h-6 ${isActive ? 'scale-110 text-cyan-400' : 'text-gray-500'}`}>
                  {tab.icon}
                </span>
                <span className={`text-[10px] mt-1 font-bold tracking-wider uppercase ${
                  isActive ? 'opacity-100 text-cyan-300' : 'opacity-70'
                }`}>
                  {tab.label}
                </span>
                {isActive && (
                  <span className="absolute -top-2 w-8 h-1 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
})
