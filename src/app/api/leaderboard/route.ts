import { NextResponse } from 'next/server'
import { getLeaderboard } from '@/domains/leaderboard/leaderboard.service'
import { apiError, apiInternalError } from '@/lib/api-error'

/** GET /api/leaderboard */
export async function GET() {
  try {
    const { leaderboard, error } = await getLeaderboard()
    if (error) return apiError('INTERNAL_ERROR', error)
    return NextResponse.json({ leaderboard })
  } catch (err) {
    console.error('Leaderboard GET error:', err)
    return apiInternalError(err)
  }
}