import { NextResponse } from 'next/server'
import { checkColonyAuth } from '@/domains/colony/colony.ownership'
import { colonyInitSchema } from '@/domains/colony/colony.schemas'
import { getColonyBootstrapData } from '@/domains/colony/colony.service'
import { apiError, apiInternalError, apiValidationError } from '@/lib/api-error'

/** POST /api/colonies/sync - runs deferred colony recalculation after first render. */
export async function POST(request: Request) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiValidationError({ formErrors: ['Invalid JSON body'], fieldErrors: {} })
    }
    const parsed = colonyInitSchema.safeParse(body)
    if (!parsed.success) return apiValidationError(parsed.error.flatten())

    const { errorResponse } = await checkColonyAuth(request, parsed.data.colonyId)
    if (errorResponse) return errorResponse

    const result = await getColonyBootstrapData(parsed.data.colonyId)
    if (result.error || !result.data) return apiError('INTERNAL_ERROR', result.error || 'Sync failed')

    return NextResponse.json(result.data)
  } catch (err) {
    console.error('Colony sync POST error:', err)
    return apiInternalError(err)
  }
}
