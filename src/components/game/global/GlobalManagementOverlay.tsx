'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import type { Colony } from '@/domains/colony/colony.types'
import type { ResourceRow } from '@/domains/resource/resource.types'

const ColonyPanel = dynamic(() => import('@/components/game/ColonyPanel').then(mod => mod.ColonyPanel), {
  ssr: false,
  loading: () => null
})

const LeaderboardPanel = dynamic(() => import('@/components/game/LeaderboardPanel').then(mod => mod.LeaderboardPanel), {
  ssr: false,
  loading: () => null
})

const EventsPanel = dynamic(() => import('@/components/game/EventsPanel').then(mod => mod.EventsPanel), {
  ssr: false,
  loading: () => null
})

const WorkOrdersPanel = dynamic(() => import('@/components/game/WorkOrdersPanel').then(mod => mod.WorkOrdersPanel), {
  ssr: false,
  loading: () => null
})

const EconomyDebugPanel = dynamic(() => import('@/components/game/EconomyDebugPanel').then(mod => mod.EconomyDebugPanel), {
  ssr: false,
  loading: () => null
})

const StaffingManagementPanel = dynamic(() => import('@/components/game/StaffingManagementPanel').then(mod => mod.StaffingManagementPanel), {
  ssr: false,
  loading: () => null
})

const AccountPanel = dynamic(() => import('@/components/game/AccountPanel').then(mod => mod.AccountPanel), {
  ssr: false,
  loading: () => null
})

export interface GlobalManagementOverlayProps {
  colonyId: string
  colony: Colony | null
  colonyLoading: boolean
  resources: ResourceRow[]
  userEmail?: string
  userId?: string
  tgUser?: { id: number; first_name: string; username?: string } | null
  isTWA?: boolean
  onLogout: () => void
  onClose: () => void
}

type TabType = 'profile' | 'leaderboard' | 'events' | 'orders' | 'staffing' | 'economy'

export function GlobalManagementOverlay({
  colonyId,
  colony,
  colonyLoading,
  resources,
  userEmail,
  userId,
  tgUser,
  isTWA,
  onLogout,
  onClose
}: GlobalManagementOverlayProps) {
  const [activeTab, setActiveTab] = useState<TabType>('profile')

  return (
    <>
      {/* Soft Backdrop */}
      <div 
        className="absolute inset-0 z-20 bg-black/30 backdrop-blur-[2px] transition-opacity" 
        onClick={onClose} 
      />

      {/* Side Panel */}
      <div data-testid="global-management-overlay" className="absolute top-[60px] bottom-[60px] right-0 w-[460px] z-30 flex flex-col bg-gray-900/95 backdrop-blur-xl border-l border-t border-b border-gray-700/80 rounded-l-3xl shadow-[-10px_0_40px_rgba(0,0,0,0.9)] animate-slide-in-right overflow-hidden">
        <div className="flex flex-col h-full relative">
          {/* Header / Tabs */}
          <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-gray-700/50 bg-black/20">
            <div className="flex flex-col gap-3 w-full">
              <div className="flex justify-between items-center w-full">
                <h2 className="text-xl font-bold text-white tracking-widest uppercase flex items-center gap-3">
                  <span className="w-3 h-3 bg-purple-500 rounded-sm shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
                  Intelligence HQ
                </h2>
                <button 
                  onClick={onClose}
                  className="text-gray-400 hover:text-white flex items-center justify-center w-8 h-8 font-mono border border-transparent hover:border-red-500/50 hover:bg-red-500/10 transition-all rounded"
                  title="Close"
                >
                  <span className="text-lg leading-none">&times;</span>
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <TabButton 
                  testId="global-tab-profile"
                  active={activeTab === 'profile'} 
                  onClick={() => setActiveTab('profile')}
                >
                  Profile
                </TabButton>
                <TabButton 
                  testId="global-tab-leaderboard"
                  active={activeTab === 'leaderboard'} 
                  onClick={() => setActiveTab('leaderboard')}
                >
                  Leaderboard
                </TabButton>
                <TabButton 
                  testId="global-tab-events"
                  active={activeTab === 'events'} 
                  onClick={() => setActiveTab('events')}
                >
                  Events
                </TabButton>
                <TabButton 
                  testId="global-tab-orders"
                  active={activeTab === 'orders'} 
                  onClick={() => setActiveTab('orders')}
                >
                  Work Orders
                </TabButton>
                <TabButton
                  testId="global-tab-staffing"
                  active={activeTab === 'staffing'}
                  onClick={() => setActiveTab('staffing')}
                >
                  Staffing
                </TabButton>
                <TabButton 
                  testId="global-tab-economy"
                  active={activeTab === 'economy'} 
                  onClick={() => setActiveTab('economy')}
                >
                  Economy
                </TabButton>
              </div>
            </div>
          </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto relative p-6">
          <div className="max-w-4xl mx-auto h-full">
            {activeTab === 'profile' && (
              <div className="bg-gray-900/60 border border-gray-800 p-6 rounded-lg shadow-2xl h-full overflow-y-auto">
                <h3 className="text-sm font-bold text-gray-400 tracking-widest uppercase mb-6">Colony Identity</h3>
                <div className="max-w-md space-y-4">
                  <AccountPanel
                    userEmail={userEmail}
                    userId={userId}
                    colonyId={colonyId}
                    tgUser={tgUser}
                    isTWA={isTWA}
                    onLogout={onLogout}
                  />
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
                  <EventsPanel colonyId={colonyId} />
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="bg-gray-900/60 border border-gray-800 p-6 rounded-lg shadow-2xl h-full overflow-hidden flex flex-col">
                <h3 className="text-sm font-bold text-gray-400 tracking-widest uppercase mb-6">Colony Work Orders</h3>
                <div className="flex-1 overflow-y-auto">
                  <WorkOrdersPanel colonyId={colonyId} resources={resources} />
                </div>
              </div>
            )}

            {activeTab === 'staffing' && (
              <div className="bg-gray-900/60 border border-gray-800 p-6 rounded-lg shadow-2xl h-full overflow-hidden flex flex-col">
                <h3 className="text-sm font-bold text-gray-400 tracking-widest uppercase mb-6">Colony Staffing</h3>
                <div className="flex-1 overflow-y-auto">
                  <StaffingManagementPanel colonyId={colonyId} />
                </div>
              </div>
            )}

            {activeTab === 'economy' && (
              <div className="bg-gray-900/60 border border-gray-800 p-6 rounded-lg shadow-2xl h-full overflow-hidden flex flex-col">
                <h3 className="text-sm font-bold text-gray-400 tracking-widest uppercase mb-6">Economy Diagnostics</h3>
                <div className="flex-1 overflow-y-auto">
                  <EconomyDebugPanel colonyId={colonyId} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

function TabButton({ active, onClick, children, testId }: { active: boolean, onClick: () => void, children: React.ReactNode, testId: string }) {
  if (active) {
    return (
      <button data-testid={testId} className="px-3 py-2 rounded font-bold text-[10px] tracking-widest uppercase transition-all bg-purple-900/40 border border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.15)] relative">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,1)]" />
        {children}
      </button>
    )
  }
  
  return (
    <button 
      data-testid={testId}
      onClick={onClick}
      className="px-3 py-2 rounded font-bold text-[10px] tracking-widest uppercase transition-all bg-black/60 border border-purple-900/30 text-gray-400 hover:text-purple-300 hover:bg-black/80 hover:border-purple-500/50"
    >
      {children}
    </button>
  )
}
