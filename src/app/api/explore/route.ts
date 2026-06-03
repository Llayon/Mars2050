import { NextResponse } from 'next/server'
import { discoverLocationSchema } from '@/domains/map/map.schemas'
import { discoverLocation, getMapLocations } from '@/domains/map/map.service'
import { recalculateResources } from '@/domains/resource/resource.service'
import { apiError, apiInternalError, apiValidationError } from '@/lib/api-error'

/**
 * GET /api/map
 * Returns all map locations, generating them if empty.
 */
export async function GET() {
  try {
    const locations = await getMapLocations()
    return NextResponse.json({ locations })
  } catch (err) {
    console.error('Map GET error:', err)
    return apiInternalError(err)
  }
}

/**
 * POST /api/explore
 * Discovers a map location.
 * Body: { locationId: string, colonyId: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = discoverLocationSchema.safeParse(body)

    if (!parsed.success) {
      return apiValidationError(parsed.error.flatten())
    }

    // Lazy recalculate resources before exploration
    await recalculateResources(parsed.data.colonyId)

    const result = await discoverLocation(parsed.data.locationId, parsed.data.colonyId)

    if (result.error) {
      return apiError('BAD_REQUEST', result.error)
    }

    return NextResponse.json({
      location: result.location,
      rewards: result.rewards,
      message: result.rewards
        ? `Локация исследована! Получено: ${Object.entries(result.rewards).map(([k, v]) => `${v} ${k}`).join(', ')}`
        : 'Локация исследована!'
    })
  } catch (err) {
    console.error('Explore POST error:', err)
    return apiInternalError(err)
  }
}