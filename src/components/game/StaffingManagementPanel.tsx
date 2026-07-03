'use client'

import { memo, useMemo, useState } from 'react'
import { buildStaffingManagementSummary } from '@/domains/building/building.staffing-summary'
import type { BuildingSettingsUpdate, BuildingWorkPriority } from '@/domains/building/building.types'
import type { PopulationTier } from '@/domains/population/population.types'
import { useBuildings } from '@/hooks/useBuildings'
import { usePopulation } from '@/hooks/usePopulation'
import { useWorkOrders } from '@/hooks/useWorkOrders'
import { useToast } from '@/components/ui/toast'

interface StaffingManagementPanelProps {
  colonyId: string | null
}

const TIERS: PopulationTier[] = ['worker', 'technician', 'scientist', 'director']
const PRIORITIES: BuildingWorkPriority[] = ['low', 'normal', 'high']

const TIER_LABELS: Record<PopulationTier, string> = {
  worker: 'Workers',
  technician: 'Technicians',
  scientist: 'Scientists',
  director: 'Directors',
}

const STATUS_LABELS = {
  inactive: 'Offline',
  paused: 'Paused',
  blocked: 'Blocked',
  partial: 'Partial',
  full: 'Full',
}

const STATUS_CLASSES = {
  inactive: 'text-gray-500 border-gray-700 bg-gray-900/70',
  paused: 'text-orange-300 border-orange-500/20 bg-orange-950/20',
  blocked: 'text-red-300 border-red-500/20 bg-red-950/20',
  partial: 'text-cyan-300 border-cyan-500/20 bg-cyan-950/20',
  full: 'text-emerald-300 border-emerald-500/20 bg-emerald-950/20',
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export const StaffingManagementPanel = memo(function StaffingManagementPanel({ colonyId }: StaffingManagementPanelProps) {
  const { toast } = useToast()
  const { buildings, loading: buildingsLoading, error: buildingsError, updateBuildingSettings } = useBuildings(colonyId)
  const { population, loading: populationLoading, error: populationError } = usePopulation(colonyId)
  const { workOrders, loading: ordersLoading, error: ordersError } = useWorkOrders(colonyId)
  const [tierFilter, setTierFilter] = useState<PopulationTier | 'all'>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const reservedSlots = useMemo(() => {
    return workOrders.reduce<Partial<Record<PopulationTier, number>>>((reserved, order) => {
      if (order.status !== 'active') return reserved
      reserved[order.assigned_tier] = (reserved[order.assigned_tier] || 0) + order.assigned_slots
      return reserved
    }, {})
  }, [workOrders])

  const summary = useMemo(() => {
    return buildStaffingManagementSummary(buildings, population, reservedSlots)
  }, [buildings, population, reservedSlots])

  const visibleBuildings = tierFilter === 'all'
    ? summary.buildings
    : summary.buildings.filter(building => building.tier === tierFilter)
  const loading = buildingsLoading || populationLoading || ordersLoading
  const error = buildingsError || populationError || ordersError

  async function updateSettings(buildingId: string, settings: BuildingSettingsUpdate) {
    setUpdatingId(buildingId)
    try {
      await updateBuildingSettings(buildingId, settings)
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white">Staffing Control</h3>
          <p className="text-xs text-gray-500">Зданий со сменами: {summary.buildings.length}</p>
        </div>
        {error && <span className="max-w-[220px] truncate text-xs text-red-300">{error}</span>}
      </div>

      <section className="grid grid-cols-2 gap-2">
        {summary.tiers.map(tier => {
          const available = Math.max(0, tier.population - tier.reservedSlots)
          return (
            <button
              key={tier.tier}
              onClick={() => setTierFilter(tierFilter === tier.tier ? 'all' : tier.tier)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                tierFilter === tier.tier
                  ? 'border-cyan-400/60 bg-cyan-950/30'
                  : 'border-gray-800 bg-black/30 hover:border-cyan-700/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white">{TIER_LABELS[tier.tier]}</span>
                <span className="font-mono text-[11px] text-cyan-200">{tier.assignedSlots}/{available}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-cyan-400"
                  style={{ width: `${available > 0 ? Math.min(100, (tier.assignedSlots / available) * 100) : 0}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-gray-500">
                <span>Reserved {tier.reservedSlots}</span>
                <span>Free {tier.freeSlots}</span>
              </div>
            </button>
          )
        })}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500">Buildings</h4>
          {tierFilter !== 'all' && (
            <button onClick={() => setTierFilter('all')} className="text-xs text-cyan-300 hover:text-cyan-100">
              Show all
            </button>
          )}
        </div>

        {loading && summary.buildings.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-lg bg-gray-800/80 animate-pulse" />)}
          </div>
        ) : visibleBuildings.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4 text-sm text-gray-500">
            Нет зданий с рабочими сменами
          </div>
        ) : (
          <div className="space-y-2">
            {visibleBuildings.map(building => {
              const isUpdating = updatingId === building.id
              return (
                <div key={building.id} className="rounded-lg border border-gray-800 bg-black/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{building.name}</p>
                      <p className="text-xs text-gray-500">{TIER_LABELS[building.tier]} / {building.staffingMode}</p>
                    </div>
                    <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_CLASSES[building.status]}`}>
                      {STATUS_LABELS[building.status]}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex justify-between text-[10px] text-gray-500">
                        <span>Efficiency</span>
                        <span className="font-mono text-gray-300">
                          {building.assignedSlots}/{building.slots} ({formatPercent(building.efficiency)})
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
                        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.round(building.efficiency * 100)}%` }} />
                      </div>
                    </div>
                    <button
                      onClick={() => updateSettings(building.id, { paused: !building.paused })}
                      disabled={isUpdating}
                      className={`h-8 w-8 rounded-md border text-xs font-bold ${
                        building.paused
                          ? 'border-orange-500/40 bg-orange-950/30 text-orange-200'
                          : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-cyan-500/50'
                      } disabled:opacity-50`}
                      title={building.paused ? 'Возобновить' : 'Пауза'}
                    >
                      {building.paused ? '▶' : 'Ⅱ'}
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => updateSettings(building.id, {
                        staffing_mode: building.staffingMode === 'auto' ? 'manual' : 'auto',
                        assigned_workers: building.staffingMode === 'auto' ? building.assignedSlots : building.requestedSlots,
                      })}
                      disabled={isUpdating}
                      className="rounded-md border border-cyan-500/30 bg-cyan-950/30 px-2 py-1 text-[11px] font-semibold text-cyan-100 disabled:opacity-50"
                    >
                      {building.staffingMode === 'auto' ? 'Auto' : 'Manual'}
                    </button>

                    {building.staffingMode === 'auto' ? (
                      <div className="flex gap-1">
                        {PRIORITIES.map(priority => (
                          <button
                            key={priority}
                            onClick={() => updateSettings(building.id, { work_priority: priority })}
                            disabled={isUpdating}
                            className={`rounded border px-2 py-1 text-[10px] font-bold uppercase ${
                              building.workPriority === priority
                                ? 'border-purple-400/60 bg-purple-950/40 text-purple-100'
                                : 'border-gray-700 bg-gray-900 text-gray-500 hover:text-gray-300'
                            } disabled:opacity-50`}
                          >
                            {priority}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 rounded-md border border-gray-800 bg-gray-950 p-1">
                        <button
                          onClick={() => updateSettings(building.id, { assigned_workers: Math.max(0, building.requestedSlots - 1) })}
                          disabled={isUpdating || building.requestedSlots <= 0}
                          className="h-6 w-7 rounded bg-gray-800 text-gray-200 disabled:opacity-40"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-mono text-xs text-white">{building.requestedSlots}</span>
                        <button
                          onClick={() => updateSettings(building.id, { assigned_workers: Math.min(building.slots, building.requestedSlots + 1) })}
                          disabled={isUpdating || building.requestedSlots >= building.slots}
                          className="h-6 w-7 rounded bg-gray-800 text-gray-200 disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
})
