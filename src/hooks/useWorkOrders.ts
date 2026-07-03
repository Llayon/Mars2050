'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkOrderRow, WorkOrderType } from '@/domains/work-order/work-order.types'
import { useSubscription } from './useSubscription'
import { fetchWithAuth } from '@/lib/fetch-with-auth'

interface WorkOrdersResponse {
  workOrders?: WorkOrderRow[]
  workOrder?: WorkOrderRow
  error?: { message?: string } | string
}

interface UseWorkOrdersReturn {
  workOrders: WorkOrderRow[]
  loading: boolean
  error: string | null
  startingType: WorkOrderType | null
  claimingId: string | null
  refetch: () => Promise<WorkOrderRow[]>
  startWorkOrder: (type: WorkOrderType) => Promise<WorkOrderRow | null>
  claimWorkOrder: (workOrderId: string) => Promise<WorkOrderRow | null>
}

function apiMessage(data: WorkOrdersResponse, fallback: string): string {
  if (typeof data.error === 'string') return data.error
  return data.error?.message || fallback
}

export function useWorkOrders(colonyId: string | null): UseWorkOrdersReturn {
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startingType, setStartingType] = useState<WorkOrderType | null>(null)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const upsertWorkOrder = useCallback((workOrder: WorkOrderRow) => {
    setWorkOrders(prev => {
      const exists = prev.some(order => order.id === workOrder.id)
      if (exists) return prev.map(order => order.id === workOrder.id ? workOrder : order)
      return [workOrder, ...prev]
    })
  }, [])

  const refetch = useCallback(async () => {
    if (!colonyId) return []
    const res = await fetchWithAuth(`/api/work-orders?colonyId=${colonyId}`)
    const data = await res.json() as WorkOrdersResponse
    if (!res.ok) throw new Error(apiMessage(data, 'Failed to fetch work orders'))
    const next = data.workOrders || []
    if (mountedRef.current) {
      setWorkOrders(next)
      setError(null)
    }
    return next
  }, [colonyId])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!colonyId) {
      setWorkOrders([])
      setLoading(false)
      return
    }

    setLoading(true)
    refetch()
      .catch(err => {
        if (mountedRef.current) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false)
      })
  }, [colonyId, refetch])

  useSubscription('work_orders', colonyId, (payload) => {
    if (payload.eventType === 'DELETE') {
      setWorkOrders(prev => prev.filter(order => order.id !== payload.old.id))
      return
    }
    upsertWorkOrder(payload.new as unknown as WorkOrderRow)
  })

  const startWorkOrder = useCallback(async (type: WorkOrderType) => {
    if (!colonyId || startingType) return null
    setStartingType(type)
    setError(null)
    try {
      const res = await fetchWithAuth('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colonyId, type }),
      })
      const data = await res.json() as WorkOrdersResponse
      if (!res.ok) throw new Error(apiMessage(data, 'Failed to start work order'))
      const workOrder = data.workOrder || null
      if (workOrder) upsertWorkOrder(workOrder)
      return workOrder
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      throw err
    } finally {
      if (mountedRef.current) setStartingType(null)
    }
  }, [colonyId, startingType, upsertWorkOrder])

  const claimWorkOrder = useCallback(async (workOrderId: string) => {
    if (!colonyId || claimingId) return null
    setClaimingId(workOrderId)
    setError(null)
    try {
      const res = await fetchWithAuth('/api/work-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colonyId, workOrderId, action: 'claim' }),
      })
      const data = await res.json() as WorkOrdersResponse
      if (!res.ok) throw new Error(apiMessage(data, 'Failed to claim work order'))
      const workOrder = data.workOrder || null
      if (workOrder) upsertWorkOrder(workOrder)
      return workOrder
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      throw err
    } finally {
      if (mountedRef.current) setClaimingId(null)
    }
  }, [claimingId, colonyId, upsertWorkOrder])

  return { workOrders, loading, error, startingType, claimingId, refetch, startWorkOrder, claimWorkOrder }
}
