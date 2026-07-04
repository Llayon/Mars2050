import { NextResponse } from 'next/server'
import { resumeColony } from '@/domains/auth/auth.service'
import { getAuthContext } from '@/lib/auth'
import { apiError, apiInternalError } from '@/lib/api-error'

/** GET /api/auth/resume - fast authenticated refresh resume. */
export async function GET(request: Request) {
  try {
    const auth = await getAuthContext(request)
    if (!auth) return apiError('UNAUTHORIZED', 'Not authenticated')

    const result = await resumeColony(auth.userId)
    if (result.error || !result.colonyId) {
      return apiError('INTERNAL_ERROR', result.error || 'Failed to resume colony')
    }

    return NextResponse.json({
      user: { id: auth.userId, email: auth.email ?? undefined },
      colonyId: result.colonyId,
    })
  } catch (err) {
    console.error('Auth resume GET error:', err)
    return apiInternalError(err)
  }
}
