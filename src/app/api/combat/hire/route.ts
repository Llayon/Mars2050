import { NextRequest, NextResponse } from 'next/server'
import { apiError, apiValidationError, apiInternalError } from '@/lib/api-error'
import { hireUnitSchema } from '@/domains/combat/combat.schemas'
import { hireUnit } from '@/domains/combat/combat.service'
import { getServerClient } from '@/domains/resource/resource.server'
import { getOrCreateColony } from '@/domains/auth/auth.service'
import type { UnitTypeKey } from '@/domains/combat/combat.types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = hireUnitSchema.safeParse(body)
    
    if (!parsed.success) {
      return apiValidationError(parsed.error.flatten())
    }

    const colonyId = parsed.data.colonyId

    const result = await hireUnit(colonyId, parsed.data.unitType as UnitTypeKey)

    if (!result.success) {
      return apiError('BAD_REQUEST', result.error || 'Failed to hire unit')
    }

    return NextResponse.json({ data: result.data })
  } catch (error) {
    return apiInternalError(error)
  }
}
