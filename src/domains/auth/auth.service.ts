import { getServerClient } from '@/domains/resource/resource.server'
import { initColonyResources } from '@/domains/colony/colony.service'
import type { AuthResult } from './auth.types'

/**
 * Get or create a colony for a user (server-side).
 * Creates colony row + initializes starting resources.
 * @param userId - Supabase user ID
 * @returns Colony ID or error
 */
export async function getOrCreateColony(userId: string): Promise<AuthResult & { colonyId: string | null }> {
  const supabase = getServerClient()

  // Check for existing colony
  const { data: colonies } = await supabase
    .from('colonies')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (colonies && colonies.length > 0) {
    return { user: null, error: null, colonyId: (colonies[0] as Record<string, unknown>).id as string }
  }

  // Create new colony
  const { data: newColony, error } = await supabase
    .from('colonies')
    .insert({ user_id: userId, name: 'Новая колония' })
    .select()
    .single()

  if (error || !newColony) {
    return { user: null, error: error?.message || 'Failed to create colony', colonyId: null }
  }

  const colonyId = (newColony as Record<string, unknown>).id as string

  // Initialize starting resources
  const resourceResult = await initColonyResources(colonyId)
  if (resourceResult.error) {
    return { user: null, error: resourceResult.error, colonyId }
  }

  return { user: null, error: null, colonyId }
}