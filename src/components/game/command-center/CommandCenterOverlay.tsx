'use client'

import { useState } from 'react'
import { DefenseTab } from './DefenseTab'
import { OperationsTab } from './OperationsTab'
import { IntelTab } from './IntelTab'
import { RecruitmentTab } from '../base-operations/RecruitmentTab'
import type { ResourceRow } from '@/domains/resource/resource.types'
import type { BattleReplayPayload } from '@/components/game/BattleHistoryPanel'

interface CommandCenterOverlayProps {
  colonyId: string
  resources: ResourceRow[]
  onClose: () => void
  onReplay: (payload: BattleReplayPayload) => void
}

type TabKey = 'recruitment' | 'defense' | 'operations' | 'intel'

export function CommandCenterOverlay({ colonyId, resources, onClose, onReplay }: CommandCenterOverlayProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('recruitment')

  return (
    <>
      {/* Soft Backdrop */}
      <div 
        className="absolute inset-0 z-20 bg-black/40 backdrop-blur-[2px] transition-opacity" 
        onClick={onClose} 
      />

      {/* Side Panel (Wide for Command Center) */}
      <div className="absolute top-[60px] bottom-[60px] left-0 right-0 z-30 flex flex-col bg-gray-900/95 backdrop-blur-xl border-t border-b border-gray-700/80 shadow-[0_0_40px_rgba(0,0,0,0.9)] animate-slide-in-right overflow-hidden">
        <div className="flex flex-col h-full relative">
          
          {/* Header / Nav */}
          <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-gray-700/50 bg-black/20">
            <div className="flex flex-col gap-3 w-full">
              <div className="flex justify-between items-center w-full">
                <h1 className="text-xl font-bold text-white tracking-widest uppercase flex items-center gap-3">
                  <span className="w-3 h-3 bg-cyan-500 rounded-sm shadow-[0_0_10px_rgba(6,182,212,0.8)] rotate-45" />
                  Command Center
                </h1>
                <button 
                  onClick={onClose}
                  className="text-gray-400 hover:text-white flex items-center justify-center w-8 h-8 font-mono border border-transparent hover:border-red-500/50 hover:bg-red-500/10 transition-all rounded"
                  title="Close"
                >
                  <span className="text-lg leading-none">&times;</span>
                </button>
              </div>
              <div className="flex gap-2">
                <NavButton active={activeTab === 'recruitment'} onClick={() => setActiveTab('recruitment')}>
                  RECRUITMENT
                </NavButton>
                <NavButton active={activeTab === 'defense'} onClick={() => setActiveTab('defense')}>
                  DEFENSE
                </NavButton>
                <NavButton active={activeTab === 'operations'} onClick={() => setActiveTab('operations')}>
                  OPERATIONS
                </NavButton>
                <NavButton active={activeTab === 'intel'} onClick={() => setActiveTab('intel')}>
                  INTEL / REPLAYS
                </NavButton>
              </div>
            </div>
          </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'recruitment' && <RecruitmentTab colonyId={colonyId} resources={resources} />}
          {activeTab === 'defense' && <DefenseTab colonyId={colonyId} />}
          {activeTab === 'operations' && <OperationsTab colonyId={colonyId} onReplay={onReplay} />}
          {activeTab === 'intel' && <IntelTab colonyId={colonyId} onReplay={onReplay} />}
        </div>
      </div>
    </div>
    </>
  )
}

function NavButton({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-mono text-sm transition-all duration-200 ${
        active 
          ? 'text-cyan-300 border-b-2 border-cyan-400 bg-cyan-900/20' 
          : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  )
}
