import { NextResponse } from 'next/server'
import { telegramAuthSchema } from '@/domains/telegram/telegram.schemas'
import { handleTelegramAuth } from '@/domains/telegram/telegram.service'
import { apiError, apiInternalError, apiValidationError } from '@/lib/api-error'

export async function POST(request: Request) {
  try {
    const parsed = telegramAuthSchema.safeParse(await request.json())
    if (!parsed.success) return apiValidationError(parsed.error.flatten())

    const result = await handleTelegramAuth(parsed.data.initData)

    if (result.error) return apiError('UNAUTHORIZED', result.error)
    return NextResponse.json({
      colonyId: result.colonyId,
      email: result.email,
      password: result.password,
    })
  } catch (err) {
    console.error('Telegram auth POST error:', err)
    return apiInternalError(err)
  }
}
