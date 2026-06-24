import { NextResponse } from 'next/server'
import { tradeSchema } from '@/domains/pvp/pvp.schemas'
import { executeTrade } from '@/domains/pvp/pvp.service'
import { apiError, apiInternalError, apiUnauthorized, apiValidationError } from '@/lib/api-error'
import { getAuthContext } from '@/lib/auth'

/** POST /api/pvp/trade — trade resources between colonies */
export async function POST(request: Request) {
  try {
    const auth = await getAuthContext(request)
    if (!auth) return apiUnauthorized()

    const parsed = tradeSchema.safeParse(await request.json())
    if (!parsed.success) return apiValidationError(parsed.error.flatten())

    const { fromColonyId, toColonyId, offerResources, requestResources } = parsed.data
    const result = await executeTrade(
      auth.client,
      auth.userId,
      fromColonyId,
      toColonyId,
      offerResources,
      requestResources
    )

    if (result.error) return apiError('BAD_REQUEST', result.error)
    return NextResponse.json(result)
  } catch (err) {
    console.error('PVP trade POST error:', err)
    return apiInternalError(err)
  }
}