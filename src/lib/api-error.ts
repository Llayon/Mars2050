import { NextResponse } from 'next/server'

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    detail?: unknown
  }
}

const STATUS_CODES: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  INTERNAL_ERROR: 500,
}

export function apiError(
  code: keyof typeof STATUS_CODES | string,
  message: string,
  detail?: unknown
): NextResponse<ApiErrorBody> {
  const status = STATUS_CODES[code] ?? 500

  const body: ApiErrorBody = {
    error: { code, message, detail },
  }

  return NextResponse.json(body, { status })
}

export function apiValidationError(detail: unknown): NextResponse<ApiErrorBody> {
  return apiError('VALIDATION_ERROR', 'Invalid request data', detail)
}

export function apiNotFound(entity: string): NextResponse<ApiErrorBody> {
  return apiError('NOT_FOUND', `${entity} not found`)
}

export function apiInternalError(err: unknown): NextResponse<ApiErrorBody> {
  const message = err instanceof Error ? err.message : 'Unknown error'
  return apiError('INTERNAL_ERROR', message)
}

export function apiUnauthorized(message = 'Authentication required'): NextResponse<ApiErrorBody> {
  return apiError('UNAUTHORIZED', message)
}

export function apiForbidden(message = 'Access denied'): NextResponse<ApiErrorBody> {
  return apiError('FORBIDDEN', message)
}
