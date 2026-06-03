import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { checkSupabaseConnection } from '@/domains/resource/resource.server'

export async function GET() {
  const checks: Record<string, string | boolean> = {}

  checks['NEXT_PUBLIC_SUPABASE_URL'] = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  checks['SUPABASE_SERVICE_ROLE_KEY'] = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  checks['supabase_connect'] = await checkSupabaseConnection()

  const allOk = Object.values(checks).every(v => v === true)

  if (!allOk) {
    return apiError('INTERNAL_ERROR', 'Health check failed', checks)
  }

  return NextResponse.json({ status: 'ok', checks })
}
