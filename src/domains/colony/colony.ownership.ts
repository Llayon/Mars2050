import type { SupabaseClient } from '@supabase/supabase-js'
import type { Colony } from './colony.types'
import { getAuthContext, type AuthContext } from '@/lib/auth'
import { apiError } from '@/lib/api-error'
import { NextResponse } from 'next/server'

/**
 * Loads a colony and validates that it belongs to the specified user.
 * Since authClient respects RLS, a user can only select their own colonies.
 * But we also explicitly check user_id = userId to be 100% secure.
 */
export async function loadOwnedColony(
  authClient: SupabaseClient,
  userId: string,
  colonyId: string
): Promise<{ colony: Colony | null; error: string | null }> {
  const { data, error } = await authClient
    .from('colonies')
    .select('*')
    .eq('id', colonyId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return { colony: null, error: error.message }
  }

  if (!data) {
    return { colony: null, error: 'Колония не найдена или не принадлежит вам' }
  }

  return { colony: data as unknown as Colony, error: null }
}

/**
 * Performs authentication and ownership checks for a given colonyId.
 * Returns the auth context and colony if successful, or a NextResponse error if failed.
 */
export async function checkColonyAuth(
  request: Request,
  colonyId: string
): Promise<
  | { auth: AuthContext; colony: Colony; errorResponse?: null }
  | { auth?: null; colony?: null; errorResponse: NextResponse<any> }
> {
  const auth = await getAuthContext(request)
  if (!auth) {
    return { errorResponse: apiError('UNAUTHORIZED', 'Not authenticated') }
  }

  const { colony, error } = await loadOwnedColony(auth.client, auth.userId, colonyId)
  if (error || !colony) {
    return { errorResponse: apiError('FORBIDDEN', error || 'Forbidden') }
  }

  return { auth, colony }
}
