'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import { WORK_ORDER_TYPES } from '@/domains/work-order/work-order.config'
import type { ResourceAmountMap, WorkOrderRow, WorkOrderType } from '@/domains/work-order/work-order.types'
import type { ResourceRow, ResourceTypeKey } from '@/domains/resource/resource.types'
import { RESOURCE_NAMES } from '@/domains/resource/resource.types'
import { ResourceIcon } from '@/components/ui/icons/ResourceIcon'
import { useWorkOrders } from '@/hooks/useWorkOrders'
import { useToast } from '@/components/ui/toast'

interface WorkOrdersPanelProps {
  colonyId: string | null
  resources: ResourceRow[]
  compact?: boolean
}

const ORDER_TYPES = Object.keys(WORK_ORDER_TYPES) as WorkOrderType[]

const TIER_NAMES = {
  worker: 'Рабочие',
  technician: 'Техники',
  scientist: 'Ученые',
  director: 'Директора',
}

function getResourceAmount(resources: ResourceRow[], type: ResourceTypeKey): number {
  return resources.find(resource => resource.type === type)?.amount || 0
}

function hasEnoughResources(resources: ResourceRow[], cost: ResourceAmountMap): boolean {
  return Object.entries(cost).every(([type, amount]) => {
    return getResourceAmount(resources, type as ResourceTypeKey) >= (amount || 0)
  })
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} мин.`
  const hours = Math.floor(minutes / 60)
  const left = minutes % 60
  return left > 0 ? `${hours} ч. ${left} мин.` : `${hours} ч.`
}

function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return 'Готово'
  const totalSeconds = Math.ceil(msLeft / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes >= 60) return formatMinutes(Math.ceil(minutes))
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function progressPercent(order: WorkOrderRow, now: number): number {
  const started = new Date(order.started_at).getTime()
  const completes = new Date(order.completes_at).getTime()
  if (completes <= started) return 100
  return Math.max(0, Math.min(100, ((now - started) / (completes - started)) * 100))
}

function ResourcePills({ amounts, tone }: { amounts: ResourceAmountMap; tone: 'cost' | 'reward' }) {
  const entries = Object.entries(amounts).filter(([, amount]) => (amount || 0) > 0)
  if (entries.length === 0) return <span className="text-xs text-gray-500">нет</span>

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([type, amount]) => (
        <span
          key={type}
          title={RESOURCE_NAMES[type] || type}
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] ${
            tone === 'cost'
              ? 'border-red-500/20 bg-red-950/20 text-red-200'
              : 'border-emerald-500/20 bg-emerald-950/20 text-emerald-200'
          }`}
        >
          <ResourceIcon type={type} className="h-3 w-3" />
          {amount}
        </span>
      ))}
    </div>
  )
}

export const WorkOrdersPanel = memo(function WorkOrdersPanel({ colonyId, resources, compact }: WorkOrdersPanelProps) {
  const { toast } = useToast()
  const { workOrders, loading, error, startingType, claimingId, startWorkOrder, claimWorkOrder } = useWorkOrders(colonyId)
  const [now, setNow] = useState(() => Date.now())

  const visibleOrders = useMemo(() => {
    return workOrders
      .filter(order => order.status !== 'claimed')
      .sort((a, b) => new Date(a.completes_at).getTime() - new Date(b.completes_at).getTime())
  }, [workOrders])

  useEffect(() => {
    if (!visibleOrders.some(order => order.status === 'active')) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [visibleOrders])

  async function handleStart(type: WorkOrderType) {
    try {
      const order = await startWorkOrder(type)
      if (order) toast(`${WORK_ORDER_TYPES[type].name}: задание запущено`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    }
  }

  async function handleClaim(order: WorkOrderRow) {
    try {
      const claimed = await claimWorkOrder(order.id)
      if (claimed) toast(`${WORK_ORDER_TYPES[order.type].name}: награда получена`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-lg bg-gray-800/80 animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white">Задания колонии</h3>
          <p className="text-xs text-gray-500">Активные бригады: {visibleOrders.filter(order => order.status === 'active').length}</p>
        </div>
        {error && <span className="max-w-[220px] truncate text-xs text-red-300">{error}</span>}
      </div>

      <section className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500">Доступные задания</h4>
        <div className={compact ? 'space-y-2' : 'grid gap-2 md:grid-cols-2'}>
          {ORDER_TYPES.map(type => {
            const config = WORK_ORDER_TYPES[type]
            const canStart = !!colonyId && hasEnoughResources(resources, config.cost)
            return (
              <div key={type} className="rounded-lg border border-gray-700/70 bg-gray-900/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{config.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-400">{config.description}</p>
                  </div>
                  <span className="shrink-0 rounded border border-cyan-500/30 bg-cyan-950/30 px-2 py-1 text-[10px] uppercase tracking-wide text-cyan-200">
                    {TIER_NAMES[config.assignedTier]}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">Цена</p>
                    <ResourcePills amounts={config.cost} tone="cost" />
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">Награда</p>
                    <ResourcePills amounts={config.reward} tone="reward" />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500">
                    {config.assignedSlots} сл. / {formatMinutes(config.durationMinutes)}
                  </span>
                  <button
                    onClick={() => handleStart(type)}
                    disabled={!canStart || startingType !== null}
                    className="rounded-md border border-cyan-500/30 bg-cyan-950/40 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-900/60 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {startingType === type ? 'Запуск...' : 'Запустить'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500">В работе</h4>
        {visibleOrders.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4 text-center text-sm text-gray-500">
            Активных заданий нет
          </div>
        ) : (
          <div className="space-y-2">
            {visibleOrders.map(order => {
              const config = WORK_ORDER_TYPES[order.type]
              const ready = order.status === 'completed' || new Date(order.completes_at).getTime() <= now
              return (
                <div key={order.id} className="rounded-lg border border-gray-700/70 bg-black/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{config.name}</p>
                      <p className="text-xs text-gray-500">
                        {TIER_NAMES[order.assigned_tier]}: {order.assigned_slots} сл.
                      </p>
                    </div>
                    <span className={`text-xs font-semibold ${ready ? 'text-emerald-300' : 'text-cyan-300'}`}>
                      {ready ? 'Готово' : formatCountdown(new Date(order.completes_at).getTime() - now)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-800">
                    <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${ready ? 100 : progressPercent(order, now)}%` }} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <ResourcePills amounts={order.reward} tone="reward" />
                    <button
                      onClick={() => handleClaim(order)}
                      disabled={!ready || claimingId !== null}
                      className="rounded-md border border-emerald-500/30 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition-colors hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {claimingId === order.id ? 'Получение...' : 'Забрать'}
                    </button>
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
