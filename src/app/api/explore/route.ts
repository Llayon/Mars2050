import { NextResponse } from 'next/server'
import { discoverLocationSchema } from '@/domains/map/map.schemas'
import { discoverLocation, getMapLocations } from '@/domains/map/map.service'
import { recalculateResources } from '@/domains/resource/resource.service'

/**
 * GET /api/map
 * Returns all map locations, generating them if empty.
 */
export async function GET() {
  try {
    const locations = await getMapLocations()
    return NextResponse.json({ locations })
  } catch (err: any) {
    console.error('Map GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/explore
 * Discovers a map location.
 * Recalculates resources first (lazy calculation), then deducts cost and grants rewards.
 * Body: { locationId: string, colonyId: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = discoverLocationSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Lazy recalculate resources before exploration
    await recalculateResources(parsed.data.colonyId)

    const result = await discoverLocation(parsed.data.locationId, parsed.data.colonyId)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      location: result.location,
      rewards: result.rewards,
      message: result.rewards
        ? `Локация исследована! Получено: ${Object.entries(result.rewards).map(([k, v]) => `${v} ${k}`).join(', ')}`
        : 'Локация исследована!'
    })
  } catch (err: any) {
    console.error('Explore POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}