'use client'

import { memo } from 'react'
import { RESOURCE_ICONS } from '@/domains/resource/resource.types'
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
          >
            <span className="text-base leading-none">{RESOURCE_ICONS[r.type] || '❓'}</span>
            <div className="flex items-baseline gap-1">
              <AnimatedResourceValue 
                value={Math.floor(r.amount)} 
                className="text-sm font-bold text-gray-200 tabular-nums" 
              />
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
