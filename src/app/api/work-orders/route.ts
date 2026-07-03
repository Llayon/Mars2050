import { NextResponse } from 'next/server'
import { checkColonyAuth } from '@/domains/colony/colony.ownership'
import { claimWorkOrder, getWorkOrders, startWorkOrder } from '@/domains/work-order/work-order.service'
import { claimWorkOrderSchema, startWorkOrderSchema, workOrderQuerySchema } from '@/domains/work-order/work-order.schemas'
import { invalidateCache } from '@/lib/cache'
import { apiError, apiInternalError, apiValidationError } from '@/lib/api-error'

const invalidateEconomyState = (colonyId: string) => {
  invalidateCache(`resources:${colonyId}`)
  invalidateCache(`buildings:${colonyId}`)
}

export async function GET(request: Request) {
  try {
    const colonyId = new URL(request.url).searchParams.get('colonyId') || ''
    const parsed = workOrderQuerySchema.safeParse({ colonyId })
    if (!parsed.success) return apiValidationError(parsed.error.flatten())
    const { errorResponse } = await checkColonyAuth(request, parsed.data.colonyId)
    if (errorResponse) return errorResponse
    const workOrders = await getWorkOrders(parsed.data.colonyId)
    return NextResponse.json({ workOrders })
  } catch (e) {
    return apiInternalError(e)
  }
}

export async function POST(request: Request) {
  try {
    const parsed = startWorkOrderSchema.safeParse(await request.json())
    if (!parsed.success) return apiValidationError(parsed.error.flatten())
    const { errorResponse } = await checkColonyAuth(request, parsed.data.colonyId)
    if (errorResponse) return errorResponse
    const result = await startWorkOrder(parsed.data)
    invalidateEconomyState(parsed.data.colonyId)
    if (result.error) return apiError('BAD_REQUEST', result.error)
    return NextResponse.json({ workOrder: result.workOrder }, { status: 201 })
  } catch (e) {
    return apiInternalError(e)
  }
}

export async function PATCH(request: Request) {
  try {
    const parsed = claimWorkOrderSchema.safeParse(await request.json())
    if (!parsed.success) return apiValidationError(parsed.error.flatten())
    const { errorResponse } = await checkColonyAuth(request, parsed.data.colonyId)
    if (errorResponse) return errorResponse
    const result = await claimWorkOrder(parsed.data)
    invalidateEconomyState(parsed.data.colonyId)
    if (result.error) return apiError('BAD_REQUEST', result.error)
    return NextResponse.json({ workOrder: result.workOrder })
  } catch (e) {
    return apiInternalError(e)
  }
}
