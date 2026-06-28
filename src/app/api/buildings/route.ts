import { NextResponse } from 'next/server'
import { buildingCreateSchema } from '@/domains/building/building.schemas'
import { createBuilding, deleteBuilding, getBuildings, verifyBuildingOwnership } from '@/domains/building/building.service'
import { recalculateResources } from '@/domains/resource/resource.service'
import { getCached, setCache, invalidateCache } from '@/lib/cache'
import { apiError, apiInternalError, apiValidationError } from '@/lib/api-error'
import { checkColonyAuth } from '@/domains/colony/colony.ownership'

export async function GET(request: Request) {
  try {
    const colonyId = new URL(request.url).searchParams.get('colonyId') || ''
    const { errorResponse } = await checkColonyAuth(request, colonyId)
    if (errorResponse) return errorResponse
    const cacheKey = `buildings:${colonyId}`
    const cached = getCached(cacheKey)
    if (cached) return NextResponse.json({ buildings: cached })
    await recalculateResources(colonyId)
    const buildings = await getBuildings(colonyId)
    setCache(cacheKey, buildings, 15)
    return NextResponse.json({ buildings })
  } catch (e) {
    return apiInternalError(e)
  }
}

export async function POST(request: Request) {
  try {
    const parsed = buildingCreateSchema.safeParse(await request.json())
    if (!parsed.success) return apiValidationError(parsed.error.flatten())
    const { errorResponse } = await checkColonyAuth(request, parsed.data.colonyId)
    if (errorResponse) return errorResponse
    await recalculateResources(parsed.data.colonyId)
    const result = await createBuilding(parsed.data)
    invalidateCache(`resources:${parsed.data.colonyId}`)
    invalidateCache(`buildings:${parsed.data.colonyId}`)
    if (result.error) return apiError('BAD_REQUEST', result.error)
    return NextResponse.json({ building: result.building }, { status: 201 })
  } catch (e) {
    return apiInternalError(e)
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const buildingId = searchParams.get('buildingId') || ''
    const colonyId = searchParams.get('colonyId') || ''
    const { auth, errorResponse } = await checkColonyAuth(request, colonyId)
    if (errorResponse) return errorResponse
    const isOwned = await verifyBuildingOwnership(auth.client, buildingId, colonyId)
    if (!isOwned) return apiError('FORBIDDEN', 'Building not found or access denied')
    await recalculateResources(colonyId)
    const result = await deleteBuilding(buildingId, colonyId)
    invalidateCache(`resources:${colonyId}`)
    invalidateCache(`buildings:${colonyId}`)
    if (result.error) return apiError('INTERNAL_ERROR', result.error)
    return NextResponse.json({ success: true })
  } catch (e) {
    return apiInternalError(e)
  }
}
