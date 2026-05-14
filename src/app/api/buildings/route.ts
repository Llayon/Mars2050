import { NextResponse } from 'next/server'
import { buildingCreateSchema } from '@/domains/building/building.schemas'
import { createBuilding, deleteBuilding, getBuildings } from '@/domains/building/building.service'
import { recalculateResources } from '@/domains/resource/resource.service'
import { getCached, setCache, invalidateCache } from '@/lib/cache'

function err(msg: string, status = 500) {
  return NextResponse.json({ error: msg }, { status })
}

/** GET /api/buildings?colonyId=xxx */
export async function GET(request: Request) {
  try {
    const colonyId = new URL(request.url).searchParams.get('colonyId')
    if (!colonyId) return err('colonyId is required', 400)

    const cacheKey = `buildings:${colonyId}`
    const cached = getCached(cacheKey)
    if (cached) return NextResponse.json({ buildings: cached })

    await recalculateResources(colonyId)
    const buildings = await getBuildings(colonyId)

    setCache(cacheKey, buildings, 15)
    return NextResponse.json({ buildings })
  } catch (e) {
    console.error('Buildings GET error:', e)
    return err(String(e))
  }
}

/** POST /api/buildings — create building */
export async function POST(request: Request) {
  try {
    const parsed = buildingCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    await recalculateResources(parsed.data.colonyId)
    const result = await createBuilding(parsed.data)

    // Invalidate cache — data changed
    invalidateCache(`resources:${parsed.data.colonyId}`)
    invalidateCache(`buildings:${parsed.data.colonyId}`)

    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ building: result.building }, { status: 201 })
  } catch (e) {
    console.error('Buildings POST error:', e)
    return err(String(e))
  }
}

/** DELETE /api/buildings?buildingId=xxx&colonyId=xxx */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const buildingId = searchParams.get('buildingId')
    const colonyId = searchParams.get('colonyId')
    if (!buildingId || !colonyId) return err('buildingId and colonyId are required', 400)

    await recalculateResources(colonyId)
    const result = await deleteBuilding(buildingId, colonyId)

    // Invalidate cache — data changed
    invalidateCache(`resources:${colonyId}`)
    invalidateCache(`buildings:${colonyId}`)

    if (result.error) return err(result.error, 500)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Buildings DELETE error:', e)
    return err(String(e))
  }
}
