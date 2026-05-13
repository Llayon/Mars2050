import { NextResponse } from 'next/server'
import { tradeSchema } from '@/domains/pvp/pvp.schemas'
import { executeTrade } from '@/domains/pvp/pvp.service'

/** POST /api/pvp/trade — trade resources between colonies */
export async function POST(request: Request) {
  try {
    const parsed = tradeSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { fromColonyId, toColonyId, offerResources, requestResources } = parsed.data
    const result = await executeTrade(fromColonyId, toColonyId, offerResources, requestResources)

    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json(result)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}