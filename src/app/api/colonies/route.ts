import { NextResponse } from 'next/server'
import { colonyCreateSchema } from '@/domains/colony/colony.schemas'
import { getOrCreateColony } from '@/domains/auth/auth.service'

/** POST /api/colonies — get or create a colony for a user */
export async function POST(request: Request) {
  try {
    const parsed = colonyCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const result = await getOrCreateColony(parsed.data.userId)

    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json({ colonyId: result.colonyId })
  } catch (err: unknown) {
    console.error('Colonies POST error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}