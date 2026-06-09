import { processCompletedEvents } from '@/domains/resource/resource.events'
import { processEventsSchema } from '@/domains/events/events.schemas'
import { apiValidationError, apiInternalError } from '@/lib/api-error'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = processEventsSchema.safeParse(body)
    if (!parsed.success) {
      return apiValidationError(parsed.error.flatten())
    }

    await processCompletedEvents(parsed.data.colony_id)

    return NextResponse.json({ processed: true })
  } catch (err) {
    console.error('Events process POST error:', err)
    return apiInternalError(err)
  }
}
