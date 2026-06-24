import { NextResponse } from 'next/server'
import { battleIdSchema } from '@/domains/pvp/pvp.schemas'
import { getAuthContext } from '@/lib/auth'
import { loadAuthorizedBattle } from '@/domains/pvp/pvp.replay'
import { apiError, apiForbidden, apiInternalError, apiUnauthorized, apiValidationError } from '@/lib/api-error'

/**
 * GET /api/pvp/battle/:battleId — fetch the replay snapshot for a battle.
 * Access is limited to participants: the user must own either the attacker
 * or the defender colony.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ battleId: string }> }
) {
  try {
    const auth = await getAuthContext(request)
    if (!auth) return apiUnauthorized()

    const { battleId } = await params
    const parsed = battleIdSchema.safeParse({ battleId })
    if (!parsed.success) return apiValidationError(parsed.error.flatten())

    const result = await loadAuthorizedBattle(auth.client, parsed.data.battleId)
    if (!result) return apiForbidden('Not a participant or battle not found')

    return NextResponse.json(result)
  } catch (err) {
    console.error('PVP battle GET error:', err)
    return apiInternalError(err)
  }
}
