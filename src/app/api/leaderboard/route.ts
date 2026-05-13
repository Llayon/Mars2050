import { NextResponse } from 'next/server'
import { getLeaderboard } from '@/domains/leaderboard/leaderboard.service'

/** GET /api/leaderboard */
export async function GET() {
  try {
    const { leaderboard, error } = await getLeaderboard()
    if (error) return NextResponse.json({ error }, { status: 500 })
    return NextResponse.json({ leaderboard })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}