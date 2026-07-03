import { NextResponse } from 'next/server'
import { E2E_AUTH_COOKIE, isE2eAuthBypassEnabled } from '@/domains/e2e/e2e.config'
import { getOrCreateE2eSession } from '@/domains/e2e/e2e.service'
import { apiError, apiInternalError } from '@/lib/api-error'

function withE2eCookie(response: NextResponse, userId: string): NextResponse {
  response.cookies.set(E2E_AUTH_COOKIE, userId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  })
  return response
}

/** GET /api/e2e/session — dev/test-only auth bypass session */
export async function GET() {
  if (!isE2eAuthBypassEnabled()) return apiError('NOT_FOUND', 'Not found')

  try {
    const result = await getOrCreateE2eSession()
    if (result.error || !result.data) return apiError('INTERNAL_ERROR', result.error || 'E2E session failed')
    return withE2eCookie(NextResponse.json(result.data), result.data.user.id)
  } catch (err) {
    return apiInternalError(err)
  }
}
