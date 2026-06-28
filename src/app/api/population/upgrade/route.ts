import { NextRequest, NextResponse } from 'next/server'
import { upgradePopulationSchema } from '@/domains/population/population.schemas'
import { upgradePopulation } from '@/domains/population/population.service'
import { apiError, apiValidationError, apiInternalError } from '@/lib/api-error'
import { getAuthContext } from '@/lib/auth'
import { checkColonyAuth } from '@/domains/colony/colony.ownership'

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return apiError('UNAUTHORIZED', 'Not authenticated')

    const parsed = upgradePopulationSchema.safeParse(await req.json())
    if (!parsed.success) return apiValidationError(parsed.error.flatten())

    const { colonyId, fromTier, count } = parsed.data
    const { errorResponse } = await checkColonyAuth(req, colonyId)
    if (errorResponse) return errorResponse

    const result = await upgradePopulation(auth.userId, colonyId, fromTier, count)
    if (result.error) return NextResponse.json(result.error, { status: 400 })

    return NextResponse.json({ data: result.data }, { status: 200 })
  } catch (error) {
    return apiInternalError(error)
  }
}
