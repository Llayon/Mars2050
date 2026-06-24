import { NextResponse } from 'next/server'
import { attackSchema } from '@/domains/pvp/pvp.schemas'
import { executeAttack } from '@/domains/pvp/pvp.service'
import { apiError, apiInternalError, apiUnauthorized, apiValidationError } from '@/lib/api-error'
import { getAuthContext } from '@/lib/auth'

/** POST /api/pvp/attack — attack another colony */
export async function POST(request: Request) {
  try {
    const auth = await getAuthContext(request)
    if (!auth) return apiUnauthorized()

    const parsed = attackSchema.safeParse(await request.json())
    if (!parsed.success) return apiValidationError(parsed.error.flatten())

    const { attackerColonyId, defenderColonyId, attackerUnitsPlacement, clientSeed } = parsed.data
    const result = await executeAttack(
      auth.client,
      auth.userId,
      attackerColonyId,
      defenderColonyId,
      clientSeed,
      attackerUnitsPlacement
    )

    if (result.error) return apiError('BAD_REQUEST', result.error)
    return NextResponse.json(result)
  } catch (err) {
    console.error('PVP attack POST error:', err)
    return apiInternalError(err)
  }
}