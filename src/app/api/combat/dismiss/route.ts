import { NextRequest, NextResponse } from 'next/server'
import { apiError, apiValidationError, apiInternalError } from '@/lib/api-error'
import { dismissUnitSchema } from '@/domains/combat/combat.schemas'
import { dismissUnit } from '@/domains/combat/combat.service'
import { getServerClient } from '@/domains/resource/resource.server'
import { getOrCreateColony } from '@/domains/auth/auth.service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = dismissUnitSchema.safeParse(body)
    
    if (!parsed.success) {
      return apiValidationError(parsed.error.flatten())
    }

    const colonyId = parsed.data.colonyId

    const result = await dismissUnit(colonyId, parsed.data.unitId)

    if (!result.success) {
      return apiError('BAD_REQUEST', result.error || 'Failed to dismiss unit')
    }

    return NextResponse.json({ message: result.message })
  } catch (error) {
    return apiInternalError(error)
  }
}
