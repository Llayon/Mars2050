import { NextResponse } from 'next/server'
import { recalculateResources } from '@/domains/resource/resource.service'
import { getCached, setCache, invalidateCache } from '@/lib/cache'
import { apiError, apiInternalError } from '@/lib/api-error'
import { checkColonyAuth } from '@/domains/colony/colony.ownership'

/**
 * GET /api/resources?colonyId=xxx
 * Returns all resources for a colony.
 * Recalculates resources first (lazy calculation).
 * Cached for 10 seconds to reduce DB load.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const colonyId = searchParams.get('colonyId')

    if (!colonyId) {
      return apiError('BAD_REQUEST', 'colonyId is required')
    }

    const { errorResponse } = await checkColonyAuth(request, colonyId)
    if (errorResponse) return errorResponse

    // Check cache (30 second TTL)
    const cacheKey = `resources:${colonyId}`
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json({ resources: cached })
    }

    // Lazy recalculate resources
    const resources = await recalculateResources(colonyId)

    if (!resources) {
      return apiError('INTERNAL_ERROR', 'Failed to recalculate resources')
    }

    setCache(cacheKey, resources, 30)

    // Invalidate old colonies list after resource change
    invalidateCache(`colonies:${colonyId}`)

    return NextResponse.json({ resources })
  } catch (err) {
    console.error('Resources GET error:', err)
    return apiInternalError(err)
  }
}
