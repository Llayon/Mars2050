import { NextResponse } from 'next/server'
import { attackSchema } from '@/domains/pvp/pvp.schemas'
import { executeAttack } from '@/domains/pvp/pvp.service'
import { apiError, apiInternalError, apiValidationError } from '@/lib/api-error'

/** POST /api/pvp/attack — attack another colony */
export async function POST(request: Request) {
  try {
    const parsed = attackSchema.safeParse(await request.json())
    if (!parsed.success) return apiValidationError(parsed.error.flatten())

    const { attackerColonyId, defenderColonyId, unitCount } = parsed.data
    const result = await executeAttack(attackerColonyId, defenderColonyId, unitCount)

    if (result.error) return apiError('BAD_REQUEST', result.error)
    return NextResponse.json(result)
  } catch (err) {
    console.error('PVP attack POST error:', err)
    return apiInternalError(err)
  }
}