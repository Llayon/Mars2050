import { NextRequest, NextResponse } from 'next/server'
import { apiError, apiValidationError, apiInternalError } from '@/lib/api-error'
import { hireUnitSchema } from '@/domains/combat/combat.schemas'
import { hireUnit } from '@/domains/combat/combat.service'
import { getServerClient } from '@/domains/resource/resource.server'
import { getOrCreateColony } from '@/domains/auth/auth.service'

export async function POST(request: NextRequest) {
  try {
    const supabase = getServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiError('UNAUTHORIZED', 'Unauthorized')
    }

    const colony = await getOrCreateColony(user.id)

    if (!colony.colonyId) {
      return apiError('NOT_FOUND', 'Colony not found')
    }

    const body = await request.json()
    const parsed = hireUnitSchema.safeParse(body)
    
    if (!parsed.success) {
      return apiValidationError(parsed.error.flatten())
    }

    const result = await hireUnit(colony.colonyId, parsed.data.unitType)

    if (!result.success) {
      return apiError('BAD_REQUEST', result.error || 'Failed to hire unit')
    }

    return NextResponse.json({ data: result.data })
  } catch (error) {
    return apiInternalError(error)
  }
}
