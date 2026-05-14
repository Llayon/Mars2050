import { NextResponse } from 'next/server'
import { recalculateResources } from '@/domains/resource/resource.service'
import { getCached, setCache, invalidateCache } from '@/lib/cache'

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
      return NextResponse.json({ error: 'colonyId is required' }, { status: 400 })
    }

    // Check cache (10 second TTL)
    const cacheKey = `resources:${colonyId}`
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json({ resources: cached })
    }

    // Lazy recalculate resources
    const resources = await recalculateResources(colonyId)

    if (!resources) {
      return NextResponse.json({ error: 'Failed to recalculate resources' }, { status: 500 })
    }

    setCache(cacheKey, resources, 10)

    // Invalidate old colonies list after resource change
    invalidateCache(`colonies:${colonyId}`)

    return NextResponse.json({ resources })
  } catch (err) {
    console.error('Resources GET error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
