import { NextRequest, NextResponse } from 'next/server'
import { apiError, apiValidationError, apiInternalError } from '@/lib/api-error'
import { dismissUnitSchema } from '@/domains/combat/combat.schemas'
import { dismissUnit } from '@/domains/combat/combat.service'
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
    const parsed = dismissUnitSchema.safeParse(body)
    
    if (!parsed.success) {
      return apiValidationError(parsed.error.flatten())
    }

    const result = await dismissUnit(colony.colonyId, parsed.data.unitId)

    if (!result.success) {
      return apiError('BAD_REQUEST', result.error || 'Failed to dismiss unit')
    }

    return NextResponse.json({ message: result.message })
  } catch (error) {
    return apiInternalError(error)
  }
}
