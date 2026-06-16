'use client'

import { memo } from 'react'
import { RESOURCE_ICONS, RESOURCE_NAMES } from '@/domains/resource/resource.types'
import type { ResourceRow } from '@/domains/resource/resource.types'

interface ResourcePanelProps {
  resources: ResourceRow[]
  loading: boolean
}

export const ResourcePanel = memo(function ResourcePanel({ resources, loading }: ResourcePanelProps) {
  if (loading) return <div className="p-4 text-gray-400 bg-gray-800 rounded-lg">Загрузка ресурсов...</div>

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-3 text-white">Ресурсы колонии</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {resources.map(r => (
          <div key={r.type} className="bg-gray-700 p-3 rounded-md">
            <div className="flex items-center justify-between">
              <span className="text-2xl">{RESOURCE_ICONS[r.type] || '❓'}</span>
              <span className="text-lg font-semibold text-white">{Math.floor(r.amount).toLocaleString('ru-RU')}</span>
            </div>
            <div className="text-sm text-gray-300 mt-1">{RESOURCE_NAMES[r.type] || r.type}</div>
            <div className="text-xs mt-1">
              <span className="text-green-400">+{Math.round(r.production_rate).toLocaleString('ru-RU')}/ч</span>
              {r.consumption_rate > 0 && <span className="text-red-400"> -{Math.round(r.consumption_rate).toLocaleString('ru-RU')}/ч</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})