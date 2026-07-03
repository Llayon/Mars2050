'use client'

import { memo } from 'react'
import { BUILDING_TYPES } from '@/domains/building/building.config'
import type { ResourceTypeKey } from '@/domains/resource/resource.types'
import { RESOURCE_NAMES } from '@/domains/resource/resource.types'
import { ResourceIcon } from '@/components/ui/icons/ResourceIcon'
import { useEconomyDebug } from '@/hooks/useEconomyDebug'
import { EconomyRecommendationsPanel } from './EconomyRecommendationsPanel'
import { EconomyStoragePanel } from './EconomyStoragePanel'

interface EconomyDebugPanelProps {
  colonyId: string | null
}

function formatRate(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}/h`
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function rateColor(value: number): string {
  if (value > 0.01) return 'text-emerald-300'
  if (value < -0.01) return 'text-red-300'
  return 'text-gray-400'
}

function resourceLabel(type: string): string {
  return RESOURCE_NAMES[type] || type
}

function tierLabel(tier: string): string {
  const names: Record<string, string> = {
    worker: 'Workers',
    technician: 'Technicians',
    scientist: 'Scientists',
    director: 'Directors',
  }
  return names[tier] || tier
}

function satisfactionColor(value: number): string {
  if (value < 0.5) return 'text-red-300'
  if (value < 0.9) return 'text-orange-300'
  return 'text-emerald-300'
}

export const EconomyDebugPanel = memo(function EconomyDebugPanel({ colonyId }: EconomyDebugPanelProps) {
  const { breakdown, loading, error, refetch } = useEconomyDebug(colonyId)

  if (loading && !breakdown) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-gray-800/80 animate-pulse" />)}
      </div>
    )
  }

  if (error && !breakdown) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4">
        <p className="text-sm text-red-200">{error}</p>
        <button onClick={() => refetch()} className="mt-3 rounded border border-red-500/30 px-3 py-1 text-xs text-red-100">
          Повторить
        </button>
      </div>
    )
  }

  if (!breakdown) {
    return <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4 text-sm text-gray-500">Нет данных</div>
  }

  const netEntries = Object.entries(breakdown.net)
    .sort(([a], [b]) => resourceLabel(a).localeCompare(resourceLabel(b)))
  const scarcityEntries = Object.entries(breakdown.scarcity)
    .filter(([, value]) => value && value.factor < 0.999)
    .sort(([, a], [, b]) => (a?.factor || 1) - (b?.factor || 1))
  const throttledBuildings = breakdown.buildings
    .filter(building => building.inputThrottle < 0.999)
    .sort((a, b) => a.inputThrottle - b.inputThrottle)
  const activeNeeds = (breakdown.populationNeeds || []).filter(tier => tier.population > 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white">Экономический разбор</h3>
          <p className="text-xs text-gray-500">Окно расчета: {Math.max(1, Math.round(breakdown.elapsedHours * 60))} мин.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="rounded-md border border-cyan-500/30 bg-cyan-950/30 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-900/50"
        >
          Обновить
        </button>
      </div>

      <EconomyRecommendationsPanel recommendations={breakdown.recommendations || []} />
      <EconomyStoragePanel storage={breakdown.storage || []} />

      <section className="rounded-lg border border-gray-800 bg-black/30 p-3">
        <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">Net rates</h4>
        <div className="grid grid-cols-2 gap-2">
          {netEntries.map(([type, value]) => (
            <div key={type} className="flex items-center justify-between rounded-md bg-gray-900/70 px-2 py-1.5">
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-gray-300">
                <ResourceIcon type={type} className="h-3.5 w-3.5 text-cyan-300" />
                <span className="truncate">{resourceLabel(type)}</span>
              </span>
              <span className={`text-xs font-mono font-bold ${rateColor(value || 0)}`}>{formatRate(value || 0)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-800 bg-black/30 p-3">
        <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">Needs / Happiness</h4>
        {activeNeeds.length === 0 ? (
          <p className="text-sm text-gray-500">Нет активного населения</p>
        ) : (
          <div className="space-y-2">
            {activeNeeds.map(tier => {
              const missingNeeds = tier.needs.filter(need => need.satisfaction < 0.999)
              return (
                <div key={tier.tier} className="rounded-md bg-gray-900/70 p-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-white">{tierLabel(tier.tier)}</span>
                    <span className="font-mono text-gray-400">{tier.population}/{tier.housingCapacity}</span>
                    <span className={`font-mono font-bold ${satisfactionColor(tier.happiness / 100)}`}>{tier.happiness}%</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
                    <span className={`rounded bg-black/30 px-1.5 py-1 ${satisfactionColor(tier.satisfaction.basic)}`}>
                      Basic {formatPercent(tier.satisfaction.basic)}
                    </span>
                    <span className={`rounded bg-black/30 px-1.5 py-1 ${satisfactionColor(tier.satisfaction.comfort)}`}>
                      Comfort {formatPercent(tier.satisfaction.comfort)}
                    </span>
                    <span className={`rounded bg-black/30 px-1.5 py-1 ${satisfactionColor(tier.satisfaction.luxury)}`}>
                      Luxury {formatPercent(tier.satisfaction.luxury)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {missingNeeds.length === 0 ? (
                      <span className="text-[10px] text-emerald-300">needs covered</span>
                    ) : missingNeeds.slice(0, 5).map(need => (
                      <span key={need.resource} className="rounded border border-orange-500/20 bg-orange-950/20 px-1.5 py-0.5 text-[10px] text-orange-200">
                        {resourceLabel(need.resource)} {formatPercent(need.satisfaction)}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-800 bg-black/30 p-3">
        <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">Дефицит inputs</h4>
        {scarcityEntries.length === 0 ? (
          <p className="text-sm text-gray-500">Входные ресурсы зданий не ограничивают производство</p>
        ) : (
          <div className="space-y-2">
            {scarcityEntries.map(([type, value]) => (
              <div key={type} className="rounded-md border border-red-500/20 bg-red-950/20 p-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-red-100">
                    <ResourceIcon type={type} className="h-3.5 w-3.5" />
                    {resourceLabel(type)}
                  </span>
                  <span className="font-mono text-red-200">{formatPercent(value?.factor || 0)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-red-950">
                  <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.round((value?.factor || 0) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-800 bg-black/30 p-3">
        <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">Здания с просадкой</h4>
        {throttledBuildings.length === 0 ? (
          <p className="text-sm text-gray-500">Здания работают без input throttling</p>
        ) : (
          <div className="space-y-2">
            {throttledBuildings.slice(0, 8).map(building => (
              <div key={building.buildingId} className="rounded-md bg-gray-900/70 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-white">
                    {BUILDING_TYPES[building.buildingType]?.name || building.buildingType}
                  </span>
                  <span className="font-mono text-xs text-orange-300">{formatPercent(building.inputThrottle)}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.keys(building.throttleReasons).map(type => (
                    <span key={type} className="rounded border border-orange-500/20 bg-orange-950/20 px-1.5 py-0.5 text-[10px] text-orange-200">
                      Не хватает {resourceLabel(type as ResourceTypeKey)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">Work orders</h4>
          {Object.keys(breakdown.reservedWorkOrderSlots).length === 0 ? (
            <p className="text-xs text-gray-500">Нет резерва слотов</p>
          ) : (
            <div className="space-y-1">
              {Object.entries(breakdown.reservedWorkOrderSlots).map(([tier, slots]) => (
                <div key={tier} className="flex justify-between text-xs text-gray-300">
                  <span>{tier}</span>
                  <span className="font-mono text-cyan-200">{slots}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">Upkeep</h4>
          <p className="text-xs text-gray-400">Population: {Object.keys(breakdown.populationConsumption).length}</p>
          <p className="text-xs text-gray-400">Army: {Object.keys(breakdown.armyUpkeep).length}</p>
        </div>
      </section>
    </div>
  )
})
