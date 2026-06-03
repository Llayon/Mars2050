import { getActiveEvents, getAllEvents, createEvent } from '@/domains/events/events.service'
import { createEventSchema, eventQuerySchema } from '@/domains/events/events.schemas'
import { NextResponse } from 'next/server'
import { getCached, setCache, invalidateCache } from '@/lib/cache'
import { apiError, apiValidationError, apiInternalError } from '@/lib/api-error'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const query = {
      colony_id: searchParams.get('colony_id') || '',
      active_only: searchParams.get('active_only') === 'true',
    }

    const parsed = eventQuerySchema.safeParse(query)
    if (!parsed.success) {
      return apiValidationError(parsed.error.flatten())
    }

    const cacheKey = `events:${parsed.data.colony_id}`

    // Cache active events for 30 seconds
    if (parsed.data.active_only) {
      const cached = getCached(cacheKey)
      if (cached) return NextResponse.json(cached)

      const events = await getActiveEvents(parsed.data.colony_id)
      setCache(cacheKey, events, 30)
      return NextResponse.json(events)
    }

    const events = await getAllEvents(parsed.data.colony_id)
    return NextResponse.json(events)
  } catch (err) {
    console.error('Events GET error:', err)
    return apiInternalError(err)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = createEventSchema.safeParse(body)

    if (!parsed.success) {
      return apiValidationError(parsed.error.flatten())
    }

    const event = await createEvent(parsed.data)

    if (!event) {
      return apiError('INTERNAL_ERROR', 'Failed to create event')
    }

    // Invalidate cache for this colony's events
    invalidateCache(`events:${parsed.data.colony_id}`)

    return NextResponse.json(event, { status: 201 })
  } catch (err) {
    console.error('Events POST error:', err)
    return apiInternalError(err)
  }
}
