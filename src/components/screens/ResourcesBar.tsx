'use client'

import { memo } from 'react'
import { ResourceIcon } from '@/components/ui/icons/ResourceIcon'
import type { ResourceRow } from '@/domains/resource/resource.types'
import { HudPanel } from '@/components/ui/hud/HudPanel'
import { AnimatedResourceValue } from '@/components/ui/hud/AnimatedResourceValue'

interface ResourcesBarProps {
  resources: ResourceRow[]
  loading: boolean
}

export const ResourcesBar = memo(function ResourcesBar({ resources, loading }: ResourcesBarProps) {
  if (loading) {
    return (
      <HudPanel className="px-3 py-2">
        <div className="flex gap-3 overflow-x-auto">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-7 w-20 bg-gray-700/50 rounded animate-pulse" />
          ))}
        </div>
      </HudPanel>
    )
  }

  return (
    <HudPanel className="px-3 py-2">
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {resources.map(r => (
          <div
            key={r.type}
            className="flex items-center gap-1.5 bg-black/30 rounded-lg px-2.5 py-1 min-w-fit hover:bg-black/50 transition-colors duration-200"
            title={`${Math.floor(r.amount).toLocaleString('ru-RU')}/${Math.floor(r.capacity).toLocaleString('ru-RU')}`}
          >
            <span className="text-cyan-400 drop-shadow-md"><ResourceIcon type={r.type} className="w-5 h-5" /></span>
            <div className="flex items-baseline gap-1">
              <AnimatedResourceValue 
                value={Math.floor(r.amount)} 
                className="text-sm font-bold text-gray-200 tabular-nums" 
              />
              <span className="text-[10px] text-gray-500">/{Math.floor(r.capacity).toLocaleString('ru-RU')}</span>
              <span className={`text-[10px] font-medium ${
                (r.production_rate - r.consumption_rate) >= 0
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}>
                {(r.production_rate - r.consumption_rate) >= 0 ? '+' : ''}
                {Math.round(r.production_rate - r.consumption_rate).toLocaleString('ru-RU')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </HudPanel>
  )
})
