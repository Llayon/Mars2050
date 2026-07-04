import { getServerClient } from '@/domains/resource/resource.server'
import { ensureColonyTerrain, initColonyResources, initColonyPopulation } from '@/domains/colony/colony.service'
import type { AuthResult } from './auth.types'

/**
 * Resolve an existing colony id without running first-load backfills.
 * Used by authenticated refresh resume where every extra DB write blocks paint.
 * @param userId - Supabase user ID
 * @returns Existing colony ID, null when the user has no colony yet, or an error
 */
export async function getExistingColonyId(userId: string): Promise<{ colonyId: string | null; error: string | null }> {
  const supabase = getServerClient()
  const { data, error } = await supabase
    .from('colonies')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (error) return { colonyId: null, error: error.message }
  return { colonyId: data ? (data as { id: string }).id : null, error: null }
}

/**
 * Fast resume path for authenticated refresh.
 * Existing users get only the colony id; new users fall back to full creation.
 * @param userId - Supabase user ID
 * @returns Colony ID or error
 */
export async function resumeColony(userId: string): Promise<AuthResult & { colonyId: string | null }> {
  const existing = await getExistingColonyId(userId)
  if (existing.error) return { user: null, error: existing.error, colonyId: null }
  if (existing.colonyId) return { user: null, error: null, colonyId: existing.colonyId }

  return getOrCreateColony(userId)
}

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
    const colony = colonies[0] as Record<string, unknown>
    const colonyId = colony.id as string

    const terrainResult = await ensureColonyTerrain(colonyId)
    if (terrainResult.error) {
      return { user: null, error: terrainResult.error, colonyId }
    }

    const resourceResult = await initColonyResources(colonyId)
    if (resourceResult.error) {
      return { user: null, error: resourceResult.error, colonyId }
    }

    await initColonyPopulation(colonyId)

    return { user: null, error: null, colonyId }
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

  const terrainResult = await ensureColonyTerrain(colonyId)
  if (terrainResult.error) {
    return { user: null, error: terrainResult.error, colonyId }
  }

  // Initialize starting resources
  const resourceResult = await initColonyResources(colonyId)
  if (resourceResult.error) {
    return { user: null, error: resourceResult.error, colonyId }
  }

  // Initialize population
  await initColonyPopulation(colonyId)

  return { user: null, error: null, colonyId }
}
