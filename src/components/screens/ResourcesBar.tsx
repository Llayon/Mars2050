'use client'

import { memo } from 'react'
import { RESOURCE_ICONS } from '@/domains/resource/resource.types'
import type { ResourceRow } from '@/domains/resource/resource.types'

interface ResourcesBarProps {
  resources: ResourceRow[]
  loading: boolean
}

export const ResourcesBar = memo(function ResourcesBar({ resources, loading }: ResourcesBarProps) {
  if (loading) {
    return (
      <div className="glass-panel rounded-xl px-3 py-2">
        <div className="flex gap-3 overflow-x-auto">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-7 w-20 bg-gray-700/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="glass-panel rounded-xl px-3 py-2">
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {resources.map(r => (
          <div
            key={r.type}
            className="flex items-center gap-1.5 bg-black/30 rounded-lg px-2.5 py-1 min-w-fit"
          >
            <span className="text-base leading-none">{RESOURCE_ICONS[r.type] || '❓'}</span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold text-white tabular-nums">
                {Math.floor(r.amount).toLocaleString('ru-RU')}
              </span>
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
    </div>
  )
})
