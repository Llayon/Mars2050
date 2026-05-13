import { NextResponse } from 'next/server'
import { getMapLocations } from '@/domains/map/map.service'

/**
 * GET /api/map
 * Returns all map locations.
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