import { NextResponse } from 'next/server'
import { E2E_AUTH_COOKIE, isE2eAuthBypassEnabled } from '@/domains/e2e/e2e.config'
import { e2eResetSchema } from '@/domains/e2e/e2e.schemas'
import { resetE2eSession } from '@/domains/e2e/e2e.service'
import { apiError, apiInternalError, apiValidationError } from '@/lib/api-error'

async function readJsonOrEmpty(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

function withE2eCookie(response: NextResponse, userId: string): NextResponse {
  response.cookies.set(E2E_AUTH_COOKIE, userId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  })
  return response
}

/** POST /api/e2e/reset — reset the isolated e2e colony */
export async function POST(request: Request) {
  if (!isE2eAuthBypassEnabled()) return apiError('NOT_FOUND', 'Not found')

  try {
    const parsed = e2eResetSchema.safeParse(await readJsonOrEmpty(request))
    if (!parsed.success) return apiValidationError(parsed.error.flatten())

    const result = await resetE2eSession()
    if (result.error || !result.data) return apiError('INTERNAL_ERROR', result.error || 'E2E reset failed')
    return withE2eCookie(NextResponse.json(result.data), result.data.user.id)
  } catch (err) {
    return apiInternalError(err)
  }
}
