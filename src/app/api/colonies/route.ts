import { NextResponse } from 'next/server'
import { colonyCreateSchema } from '@/domains/colony/colony.schemas'
import { getOrCreateColony } from '@/domains/auth/auth.service'
import { apiError, apiInternalError, apiValidationError } from '@/lib/api-error'

/** POST /api/colonies — get or create a colony for a user */
export async function POST(request: Request) {
  try {
    const parsed = colonyCreateSchema.safeParse(await request.json())
    if (!parsed.success) return apiValidationError(parsed.error.flatten())

    const result = await getOrCreateColony(parsed.data.userId)

    if (result.error) return apiError('INTERNAL_ERROR', result.error)
    return NextResponse.json({ colonyId: result.colonyId })
  } catch (err) {
    console.error('Colonies POST error:', err)
    return apiInternalError(err)
  }
}