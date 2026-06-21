import { NextResponse } from 'next/server'
import { setGarrisonSchema } from '@/domains/combat/combat.schemas'
import { setGarrison } from '@/domains/combat/combat.service'
import { apiError, apiInternalError, apiValidationError } from '@/lib/api-error'

/** POST /api/combat/garrison — set defensive deployment */
export async function POST(request: Request) {
  try {
    const parsed = setGarrisonSchema.safeParse(await request.json())
    if (!parsed.success) return apiValidationError(parsed.error.flatten())

    const { colonyId, units } = parsed.data
    const result = await setGarrison(colonyId, units)

    return NextResponse.json(result)
  } catch (err) {
    console.error('Combat garrison POST error:', err)
    return apiInternalError(err)
  }
}
