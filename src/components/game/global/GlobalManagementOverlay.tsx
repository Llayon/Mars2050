import { useState } from 'react'
import { ColonyPanel } from '@/components/game/ColonyPanel'
import { LeaderboardPanel } from '@/components/game/LeaderboardPanel'
import { EventsPanel } from '@/components/game/EventsPanel'
import type { Colony } from '@/domains/colony/colony.types'

export interface GlobalManagementOverlayProps {
  colonyId: string
  colony: Colony | null
  colonyLoading: boolean
  onCreateTestEvent: (id: string, type: string, duration: number) => Promise<boolean>
  onClose: () => void
}

type TabType = 'profile' | 'leaderboard' | 'events'

export function GlobalManagementOverlay({
  colonyId,
  colony,
  colonyLoading,
  onCreateTestEvent,
  onClose
}: GlobalManagementOverlayProps) {
  const [activeTab, setActiveTab] = useState<TabType>('profile')

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#070b12] animate-slide-in-right">
      <div className="flex flex-col h-full relative">
        {/* Header / Tabs */}
        <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-cyan-900/50 bg-black/40">
          <div className="flex gap-1 items-center">
            <h2 className="text-xl font-bold text-white tracking-widest uppercase mr-8 flex items-center gap-3">
              <span className="w-3 h-3 bg-purple-500 rounded-sm shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
              Intelligence HQ
            </h2>
            
            <TabButton 
              active={activeTab === 'profile'} 
              onClick={() => setActiveTab('profile')}
            >
              Profile
            </TabButton>
            <TabButton 
              active={activeTab === 'leaderboard'} 
              onClick={() => setActiveTab('leaderboard')}
            >
              Leaderboard
            </TabButton>
            <TabButton 
              active={activeTab === 'events'} 
              onClick={() => setActiveTab('events')}
            >
              Events
            </TabButton>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white px-3 py-1 font-mono uppercase tracking-widest border border-transparent hover:border-red-500/50 hover:bg-red-500/10 transition-all rounded"
          >
            [ X ] CLOSE
          </button>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto relative p-6">
          <div className="max-w-4xl mx-auto h-full">
            {activeTab === 'profile' && (
              <div className="bg-gray-900/60 border border-gray-800 p-6 rounded-lg shadow-2xl h-full">
                <h3 className="text-sm font-bold text-gray-400 tracking-widest uppercase mb-6">Colony Identity</h3>
                <div className="max-w-md">
                  <ColonyPanel colony={colony} loading={colonyLoading} />
                </div>
              </div>
            )}
            
            {activeTab === 'leaderboard' && (
              <div className="bg-gray-900/60 border border-gray-800 p-6 rounded-lg shadow-2xl h-full overflow-hidden flex flex-col">
                <h3 className="text-sm font-bold text-gray-400 tracking-widest uppercase mb-6">Global Rankings</h3>
                <div className="flex-1 overflow-y-auto">
                  <LeaderboardPanel />
                </div>
              </div>
            )}
            
            {activeTab === 'events' && (
              <div className="bg-gray-900/60 border border-gray-800 p-6 rounded-lg shadow-2xl h-full overflow-hidden flex flex-col">
                <h3 className="text-sm font-bold text-gray-400 tracking-widest uppercase mb-6">System Logs</h3>
                <div className="flex-1 overflow-y-auto">
                  <EventsPanel colonyId={colonyId} onCreateTest={onCreateTestEvent} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  if (active) {
    return (
      <button className="px-6 py-2 rounded font-bold text-xs tracking-widest uppercase transition-all bg-purple-900/40 border border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.15)] relative">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,1)]" />
        {children}
      </button>
    )
  }
  
  return (
    <button 
      onClick={onClick}
      className="px-6 py-2 rounded font-bold text-xs tracking-widest uppercase transition-all bg-black/60 border border-purple-900/30 text-gray-400 hover:text-purple-300 hover:bg-black/80 hover:border-purple-500/50"
    >
      {children}
    </button>
  )
}
