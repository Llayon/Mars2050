import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Verify the requesting user owns the colony.
 * Uses the user-scoped Supabase client so RLS guarantees that another
 * user's colonies are unreadable.
 * @returns the colony row when ownership is confirmed
 */
export async function loadOwnedColony(
  authClient: SupabaseClient,
  colonyId: string,
  userId: string
): Promise<{ id: string; user_id: string } | null> {
  const { data, error } = await authClient
    .from('colonies')
    .select('id, user_id')
    .eq('id', colonyId)
    .single()
  if (error || !data) return null
  if (data.user_id !== userId) return null
  return data
}
