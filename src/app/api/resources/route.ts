import { NextResponse } from 'next/server'
import { recalculateResources } from '@/domains/resource/resource.service'

/**
 * GET /api/resources?colonyId=xxx
 * Returns all resources for a colony.
 * Recalculates resources first (lazy calculation).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const colonyId = searchParams.get('colonyId')

    if (!colonyId) {
      return NextResponse.json({ error: 'colonyId is required' }, { status: 400 })
    }

    // Lazy recalculate resources
    const resources = await recalculateResources(colonyId)

    if (!resources) {
      return NextResponse.json({ error: 'Failed to recalculate resources' }, { status: 500 })
    }

    return NextResponse.json({ resources })
  } catch (err: any) {
    console.error('Resources GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}