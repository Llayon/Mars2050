'use client'

import { memo } from 'react'
import type { EconomyCrisisRecommendation, EconomyCrisisSeverity } from '@/domains/resource/resource.crisis'

interface EconomyRecommendationsPanelProps {
  recommendations: EconomyCrisisRecommendation[]
}

const severityStyles: Record<EconomyCrisisSeverity, string> = {
  critical: 'border-red-500/30 bg-red-950/25 text-red-100',
  warning: 'border-orange-500/25 bg-orange-950/20 text-orange-100',
  info: 'border-cyan-500/25 bg-cyan-950/20 text-cyan-100',
}

const severityLabels: Record<EconomyCrisisSeverity, string> = {
  critical: 'Критично',
  warning: 'Внимание',
  info: 'Инфо',
}

export const EconomyRecommendationsPanel = memo(function EconomyRecommendationsPanel({
  recommendations,
}: EconomyRecommendationsPanelProps) {
  return (
    <section className="rounded-lg border border-gray-800 bg-black/30 p-3">
      <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">Crisis recommendations</h4>
      {recommendations.length === 0 ? (
        <p className="text-sm text-gray-500">Критичных экономических проблем не найдено</p>
      ) : (
        <div className="space-y-2">
          {recommendations.map(item => (
            <div key={item.id} className={`rounded-md border p-2 ${severityStyles[item.severity]}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs font-semibold">{item.title}</span>
                <span className="shrink-0 rounded bg-black/30 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                  {severityLabels[item.severity]}
                </span>
              </div>
              <p className="mt-1 text-xs opacity-80">{item.detail}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
})
