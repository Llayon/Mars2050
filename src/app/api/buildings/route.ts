import { NextResponse } from 'next/server'
import { buildingCreateSchema } from '@/domains/building/building.schemas'
import { createBuilding, deleteBuilding, getBuildings } from '@/domains/building/building.service'
import { recalculateResources } from '@/domains/resource/resource.service'
import { getCached, setCache, invalidateCache } from '@/lib/cache'
import { apiError, apiInternalError, apiValidationError } from '@/lib/api-error'

/** GET /api/buildings?colonyId=xxx */
export async function GET(request: Request) {
  try {
    const colonyId = new URL(request.url).searchParams.get('colonyId')
    if (!colonyId) return apiError('BAD_REQUEST', 'colonyId is required')

    const cacheKey = `buildings:${colonyId}`
    const cached = getCached(cacheKey)
    if (cached) return NextResponse.json({ buildings: cached })

    await recalculateResources(colonyId)
    const buildings = await getBuildings(colonyId)

    setCache(cacheKey, buildings, 15)
    return NextResponse.json({ buildings })
  } catch (e) {
    console.error('Buildings GET error:', e)
    return apiInternalError(e)
  }
}

/** POST /api/buildings — create building */
export async function POST(request: Request) {
  try {
    const parsed = buildingCreateSchema.safeParse(await request.json())
    if (!parsed.success) return apiValidationError(parsed.error.flatten())

    await recalculateResources(parsed.data.colonyId)
    const result = await createBuilding(parsed.data)

    // Invalidate cache — data changed
    invalidateCache(`resources:${parsed.data.colonyId}`)
    invalidateCache(`buildings:${parsed.data.colonyId}`)

    if (result.error) return apiError('BAD_REQUEST', result.error)
    return NextResponse.json({ building: result.building }, { status: 201 })
  } catch (e) {
    console.error('Buildings POST error:', e)
    return apiInternalError(e)
  }
}

/** DELETE /api/buildings?buildingId=xxx&colonyId=xxx */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const buildingId = searchParams.get('buildingId')
    const colonyId = searchParams.get('colonyId')
    if (!buildingId || !colonyId) return apiError('BAD_REQUEST', 'buildingId and colonyId are required')

    await recalculateResources(colonyId)
    const result = await deleteBuilding(buildingId, colonyId)

    // Invalidate cache — data changed
    invalidateCache(`resources:${colonyId}`)
    invalidateCache(`buildings:${colonyId}`)

    if (result.error) return apiError('INTERNAL_ERROR', result.error)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Buildings DELETE error:', e)
    return apiInternalError(e)
  }
}
