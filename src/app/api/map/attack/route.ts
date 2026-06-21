import { NextResponse } from 'next/server'
import { z } from 'zod'
import { attackAlienNest } from '@/domains/map/map.combat'
import { apiError, apiInternalError, apiValidationError } from '@/lib/api-error'
import { invalidateCache } from '@/lib/cache'

const attackNestSchema = z.object({
  colonyId: z.string().uuid('Invalid colony ID'),
  locationId: z.string().uuid('Invalid location ID')
})

export async function POST(request: Request) {
  try {
    const parsed = attackNestSchema.safeParse(await request.json())
    if (!parsed.success) return apiValidationError(parsed.error.flatten())

    const result = await attackAlienNest(parsed.data.colonyId, parsed.data.locationId)
    
    invalidateCache(`map`) // Invalidate map cache globally or specifically
    invalidateCache(`resources:${parsed.data.colonyId}`)
    invalidateCache(`units:${parsed.data.colonyId}`)

    if (result.error) return apiError('BAD_REQUEST', result.error)

    return NextResponse.json(result)
  } catch (e) {
    console.error('Attack nest error:', e)
    return apiInternalError(e)
  }
}
