import { getServerClient } from '@/domains/resource/resource.server'
import { initColonyResources, initColonyPopulation } from '@/domains/colony/colony.service'
import { generateColonyTerrain } from '@/domains/colony/colony-terrain.generator'
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
    .select('id, terrain_grid')
    .eq('user_id', userId)
    .limit(1)

  if (colonies && colonies.length > 0) {
    const colony = colonies[0] as Record<string, unknown>
    const colonyId = colony.id as string
    
    const terrainGrid = colony.terrain_grid as unknown[] | null
    
    // Lazy Backfill for existing colonies without terrain
    if (!terrainGrid || (Array.isArray(terrainGrid) && terrainGrid.length === 0)) {
      const terrainGrid = generateColonyTerrain(colonyId)
      await supabase.from('colonies').update({ terrain_grid: terrainGrid }).eq('id', colonyId)
    }

    // Lazy Backfill for population
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

  // Generate terrain deterministically based on colonyId
  const terrainGrid = generateColonyTerrain(colonyId)
  await supabase.from('colonies').update({ terrain_grid: terrainGrid }).eq('id', colonyId)

  // Initialize starting resources
  const resourceResult = await initColonyResources(colonyId)
  if (resourceResult.error) {
    return { user: null, error: resourceResult.error, colonyId }
  }

  // Initialize population
  await initColonyPopulation(colonyId)

  return { user: null, error: null, colonyId }
}