import { NextResponse } from 'next/server'
import { checkColonyAuth } from '@/domains/colony/colony.ownership'
import { colonyInitSchema } from '@/domains/colony/colony.schemas'
import { getColonyBootstrapFastData } from '@/domains/colony/colony.service'
import { apiError, apiInternalError, apiValidationError } from '@/lib/api-error'

/** GET /api/colonies/bootstrap?colonyId=xxx — fast initial colony render payload */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = colonyInitSchema.safeParse({ colonyId: searchParams.get('colonyId') })
    if (!parsed.success) return apiValidationError(parsed.error.flatten())

    const { errorResponse } = await checkColonyAuth(request, parsed.data.colonyId)
    if (errorResponse) return errorResponse

    const result = await getColonyBootstrapFastData(parsed.data.colonyId)
    if (result.error || !result.data) return apiError('INTERNAL_ERROR', result.error || 'Bootstrap failed')

    return NextResponse.json(result.data)
  } catch (err) {
    console.error('Colony bootstrap GET error:', err)
    return apiInternalError(err)
  }
}
