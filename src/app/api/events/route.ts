import { getActiveEvents, getAllEvents, createEvent } from '@/domains/events/events.service'
import { createEventSchema, eventQuerySchema } from '@/domains/events/events.schemas'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const query = {
    colony_id: searchParams.get('colony_id') || '',
    active_only: searchParams.get('active_only') === 'true',
  }

  const parsed = eventQuerySchema.safeParse(query)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (parsed.data.active_only) {
    const events = await getActiveEvents(parsed.data.colony_id)
    return NextResponse.json(events)
  }

  const events = await getAllEvents(parsed.data.colony_id)
  return NextResponse.json(events)
}

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = createEventSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const event = await createEvent(parsed.data)

  if (!event) {
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }

  return NextResponse.json(event, { status: 201 })
}
