import { getServerClient } from '@/domains/resource/resource.server'
import type { PopulationTier } from '@/domains/population/population.types'
import { WORK_ORDER_TYPES } from './work-order.config'
import type { ClaimWorkOrderInput, StartWorkOrderInput } from './work-order.schemas'
import type { WorkOrderRow } from './work-order.types'

interface WorkOrderTransactionResult {
  success?: boolean
  work_order?: WorkOrderRow
  error?: string
}

type ReservedSlots = Partial<Record<PopulationTier, number>>

/**
 * Completes active work orders whose timer has expired.
 * @param colonyId - Colony ID
 */
export async function processCompletedWorkOrders(colonyId: string): Promise<void> {
  const supabase = getServerClient()
  const now = new Date().toISOString()

  await supabase
    .from('work_orders')
    .update({ status: 'completed', updated_at: now })
    .eq('colony_id', colonyId)
    .eq('status', 'active')
    .lte('completes_at', now)
}

/**
 * Returns all work orders for a colony after applying lazy completion.
 * @param colonyId - Colony ID
 */
export async function getWorkOrders(colonyId: string): Promise<WorkOrderRow[]> {
  const supabase = getServerClient()
  await processCompletedWorkOrders(colonyId)

  const { data, error } = await supabase
    .from('work_orders')
    .select('*')
    .eq('colony_id', colonyId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getWorkOrders error:', error)
    return []
  }

  return (data || []) as unknown as WorkOrderRow[]
}

/**
 * Returns active work orders for staffing reservation.
 * @param colonyId - Colony ID
 */
export async function getActiveWorkOrders(colonyId: string): Promise<WorkOrderRow[]> {
  const supabase = getServerClient()
  const { data, error } = await supabase
    .from('work_orders')
    .select('*')
    .eq('colony_id', colonyId)
    .eq('status', 'active')

  if (error) {
    console.error('getActiveWorkOrders error:', error)
    return []
  }

  return (data || []) as unknown as WorkOrderRow[]
}

/**
 * Sums active work-order reservations by population tier.
 * @param workOrders - Work orders to aggregate
 */
export function getReservedWorkOrderSlots(workOrders: WorkOrderRow[]): ReservedSlots {
  return workOrders.reduce<ReservedSlots>((reserved, order) => {
    if (order.status !== 'active') return reserved
    reserved[order.assigned_tier] = (reserved[order.assigned_tier] || 0) + order.assigned_slots
    return reserved
  }, {})
}

/**
 * Starts a work order through an atomic database transaction.
 * @param input - Work-order start DTO
 */
export async function startWorkOrder(input: StartWorkOrderInput): Promise<{ workOrder: WorkOrderRow | null; error: string | null }> {
  const config = WORK_ORDER_TYPES[input.type]
  if (!config) return { workOrder: null, error: 'Invalid work order type' }

  const supabase = getServerClient()
  await processCompletedWorkOrders(input.colonyId)

  const { data, error } = await supabase.rpc('start_work_order_transaction', {
    p_colony_id: input.colonyId,
    p_type: input.type,
    p_assigned_tier: config.assignedTier,
    p_assigned_slots: config.assignedSlots,
    p_duration_minutes: config.durationMinutes,
    p_cost: config.cost,
    p_reward: config.reward,
  })

  if (error) return { workOrder: null, error: error.message }

  const result = data as WorkOrderTransactionResult
  if (!result.success) return { workOrder: null, error: result.error || 'Failed to start work order' }
  return { workOrder: result.work_order || null, error: null }
}

/**
 * Claims a completed work order through an atomic database transaction.
 * @param input - Work-order claim DTO
 */
export async function claimWorkOrder(input: ClaimWorkOrderInput): Promise<{ workOrder: WorkOrderRow | null; error: string | null }> {
  const supabase = getServerClient()
  await processCompletedWorkOrders(input.colonyId)

  const { data, error } = await supabase.rpc('claim_work_order_transaction', {
    p_colony_id: input.colonyId,
    p_work_order_id: input.workOrderId,
  })

  if (error) return { workOrder: null, error: error.message }

  const result = data as WorkOrderTransactionResult
  if (!result.success) return { workOrder: null, error: result.error || 'Failed to claim work order' }
  return { workOrder: result.work_order || null, error: null }
}
