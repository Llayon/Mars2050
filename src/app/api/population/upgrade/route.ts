import { NextRequest, NextResponse } from 'next/server'
import { upgradePopulationSchema } from '@/domains/population/population.schemas'
import { upgradePopulation } from '@/domains/population/population.service'
import { apiError, apiValidationError, apiInternalError } from '@/lib/api-error'
import { getServerClient } from '@/domains/resource/resource.server'

export async function POST(req: NextRequest) {
  try {
    const supabase = getServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 })
    }

    const body = await req.json()
    const parsed = upgradePopulationSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json(apiValidationError(parsed.error.flatten()), { status: 400 })
    }

    const { colonyId, fromTier, count } = parsed.data

    // Process upgrade
    const result = await upgradePopulation(user.id, colonyId, fromTier, count)
    
    if (result.error) {
      // Assuming result.error is already formatted by apiError in service
      return NextResponse.json(result.error, { status: 400 }) // Simplify status
    }

    return NextResponse.json({ data: result.data }, { status: 200 })
  } catch (error) {
    return NextResponse.json(apiInternalError(error), { status: 500 })
  }
}
