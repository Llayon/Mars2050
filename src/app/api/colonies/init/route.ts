import { NextResponse } from 'next/server'
import { colonyInitSchema } from '@/domains/colony/colony.schemas'
import { initColonyResources } from '@/domains/colony/colony.service'

/** POST /api/colonies/init — initialize starting resources for a new colony */
export async function POST(request: Request) {
  try {
    const parsed = colonyInitSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const result = await initColonyResources(parsed.data.colonyId)

    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json({
      message: result.count ? 'Resources initialized' : 'Resources already initialized',
      count: result.count ?? 0
    })
  } catch (err: unknown) {
    console.error('Colony init error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}