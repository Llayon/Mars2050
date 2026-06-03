import { NextResponse } from 'next/server'
import { getMapLocations } from '@/domains/map/map.service'
import { apiInternalError } from '@/lib/api-error'

/**
 * GET /api/map
 * Returns all map locations.
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