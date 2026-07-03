'use client'

import { memo } from 'react'
import type { ResourceStorageBreakdown } from '@/domains/resource/resource.debug'
import { RESOURCE_NAMES } from '@/domains/resource/resource.types'
import { ResourceIcon } from '@/components/ui/icons/ResourceIcon'

interface EconomyStoragePanelProps {
  storage: ResourceStorageBreakdown[]
}

function formatAmount(value: number): string {
  return Math.floor(value).toLocaleString('ru-RU')
}

function fillColor(fillRatio: number): string {
  if (fillRatio >= 0.95) return 'bg-orange-400'
  if (fillRatio >= 0.75) return 'bg-yellow-400'
  return 'bg-cyan-400'
}

export const EconomyStoragePanel = memo(function EconomyStoragePanel({ storage }: EconomyStoragePanelProps) {
  const rows = [...storage].sort((a, b) => RESOURCE_NAMES[a.type].localeCompare(RESOURCE_NAMES[b.type]))

  return (
    <section className="rounded-lg border border-gray-800 bg-black/30 p-3">
      <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">Storage caps</h4>
      <div className="grid grid-cols-2 gap-2">
        {rows.map(resource => (
          <div key={resource.type} className="rounded-md bg-gray-900/70 px-2 py-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5 text-gray-300">
                <ResourceIcon type={resource.type} className="h-3.5 w-3.5 text-cyan-300" />
                <span className="truncate">{RESOURCE_NAMES[resource.type]}</span>
              </span>
              <span className="font-mono text-[11px] text-gray-400">
                {formatAmount(resource.amount)}/{formatAmount(resource.capacity)}
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-800">
              <div className={`h-full rounded-full ${fillColor(resource.fillRatio)}`} style={{ width: `${Math.round(resource.fillRatio * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
})
