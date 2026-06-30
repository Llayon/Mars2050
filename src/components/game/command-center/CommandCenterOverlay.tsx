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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 lg:p-12">
      <div className="w-full h-full max-w-7xl max-h-[90vh] bg-slate-950/90 border border-cyan-500/30 flex flex-col shadow-2xl shadow-cyan-900/20 rounded-sm overflow-hidden">
        
        {/* Header / Nav */}
        <div className="flex items-center justify-between bg-black/60 border-b border-cyan-500/30 p-4">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold tracking-widest text-white uppercase">
              Command Center
            </h1>
            <div className="flex gap-2">
              <NavButton active={activeTab === 'recruitment'} onClick={() => setActiveTab('recruitment')}>
                [ RECRUITMENT ]
              </NavButton>
              <NavButton active={activeTab === 'defense'} onClick={() => setActiveTab('defense')}>
                [ DEFENSE ]
              </NavButton>
              <NavButton active={activeTab === 'operations'} onClick={() => setActiveTab('operations')}>
                [ OPERATIONS ]
              </NavButton>
              <NavButton active={activeTab === 'intel'} onClick={() => setActiveTab('intel')}>
                [ INTEL / REPLAYS ]
              </NavButton>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white px-3 py-1 font-mono text-xl border border-transparent hover:border-red-500/50 hover:bg-red-500/10 transition-colors"
          >
            [ X ]
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'recruitment' && <RecruitmentTab colonyId={colonyId} resources={resources} />}
          {activeTab === 'defense' && <DefenseTab colonyId={colonyId} />}
          {activeTab === 'operations' && <OperationsTab colonyId={colonyId} onReplay={onReplay} />}
          {activeTab === 'intel' && <IntelTab colonyId={colonyId} onReplay={onReplay} />}
        </div>

      </div>
    </div>
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
