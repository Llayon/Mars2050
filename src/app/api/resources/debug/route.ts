import { NextResponse } from 'next/server'
import { checkColonyAuth } from '@/domains/colony/colony.ownership'
import { getEconomyDebugBreakdown } from '@/domains/resource/resource.debug'
import { resourceDebugQuerySchema } from '@/domains/resource/resource.schemas'
import { apiError, apiInternalError, apiValidationError } from '@/lib/api-error'

export async function GET(request: Request) {
  try {
    const colonyId = new URL(request.url).searchParams.get('colonyId') || ''
    const parsed = resourceDebugQuerySchema.safeParse({ colonyId })
    if (!parsed.success) return apiValidationError(parsed.error.flatten())

    const { errorResponse } = await checkColonyAuth(request, parsed.data.colonyId)
    if (errorResponse) return errorResponse

    const breakdown = await getEconomyDebugBreakdown(parsed.data.colonyId)
    if (!breakdown) return apiError('INTERNAL_ERROR', 'Failed to build economy breakdown')

    return NextResponse.json({ breakdown })
  } catch (err) {
    return apiInternalError(err)
  }
}
