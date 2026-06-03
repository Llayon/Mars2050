import { getServerClient } from '@/domains/resource/resource.server'
import type { MapLocation } from './map.types'
import { generateMarsMap, getDefaultMapConfig } from './map.generator'
import { EXPLORATION_COST, EXPLORATION_BASE_REWARD } from './map.config'

/**
 * Gets all map locations, generating them if the map is empty.
 * @returns Array of map locations with discovery status
 */
export async function getMapLocations(): Promise<MapLocation[]> {
  const supabase = getServerClient()

  const { data, error } = await supabase
    .from('map_locations')
    .select('*')
    .order('y', { ascending: true })

  if (error) {
    console.error('getMapLocations error:', error)
    return []
  }

  if (!data || data.length === 0) {
    const config = getDefaultMapConfig()
    const locations = generateMarsMap(config)

    const { error: insertError } = await supabase
      .from('map_locations')
      .insert(locations)

    if (insertError) {
      console.error('generateMap error:', insertError)
      return []
    }

    const { data: newData } = await supabase
      .from('map_locations')
      .select('*')
      .order('y', { ascending: true })

    return newData || []
  }

  return data
}

/**
 * Discovers a map location.
 * Deducts exploration cost (energy based on difficulty).
 * Grants resource rewards from the location.
 *
 * @param locationId - Location ID to discover
 * @param colonyId - Colony ID that discovers the location
 * @returns Updated location and granted resources, or error
 */
export async function discoverLocation(
  locationId: string,
  colonyId: string
): Promise<{ location: MapLocation | null; rewards: Record<string, number> | null; error: string | null }> {
  const supabase = getServerClient()

  // 1. Get location info
  const { data: location, error: locError } = await supabase
    .from('map_locations')
    .select('*')
    .eq('id', locationId)
    .single()

  if (locError || !location) {
    return { location: null, rewards: null, error: 'Location not found' }
  }

  if (location.is_discovered) {
    return { location: null, rewards: null, error: 'Location already discovered' }
  }

  // 2. Calculate exploration cost based on difficulty
  const cost = EXPLORATION_COST[location.difficulty] || EXPLORATION_COST[1]

  // 3. Check colony has enough resources
  const { data: resources, error: resError } = await supabase
    .from('resources')
    .select('type, amount')
    .eq('colony_id', colonyId)

  if (resError || !resources) {
    return { location: null, rewards: null, error: 'Failed to fetch colony resources' }
  }

  const resourceMap: Record<string, number> = {}
  for (const r of resources) {
    resourceMap[r.type] = r.amount
  }

  // Verify cost can be paid
  for (const [resourceType, amount] of Object.entries(cost)) {
    const available = resourceMap[resourceType] || 0
    if (available < amount) {
      return {
        location: null,
        rewards: null,
        error: `Not enough ${resourceType}. Need ${amount}, have ${Math.floor(available)}`
      }
    }
  }

  // 4. Deduct exploration cost
  for (const [resourceType, amount] of Object.entries(cost)) {
    const currentAmount = resourceMap[resourceType] || 0
    const newAmount = currentAmount - amount

    const { error: updateError } = await supabase
      .from('resources')
      .update({ amount: Math.max(0, newAmount) })
      .eq('colony_id', colonyId)
      .eq('type', resourceType)

    if (updateError) {
      console.error('Failed to deduct exploration cost:', resourceType, updateError)
    }
  }

  // 5. Calculate and grant resource rewards
  const locationResources = location.resources as Record<string, number> || {}
  const rewards: Record<string, number> = {}

  for (const [resourceType, multiplier] of Object.entries(locationResources)) {
    // Resources in location are ~10-200 range (generated as base * multiplier)
    // Scale down to reasonable reward amounts
    const reward = Math.round(multiplier * EXPLORATION_BASE_REWARD / 100)
    if (reward > 0) {
      rewards[resourceType] = reward

      const currentAmount = resourceMap[resourceType] || 0
      const { error: rewardError } = await supabase
        .from('resources')
        .update({ amount: currentAmount + reward })
        .eq('colony_id', colonyId)
        .eq('type', resourceType)

      if (rewardError) {
        console.error('Failed to grant reward:', resourceType, rewardError)
      }
    }
  }

  // 6. Mark location as discovered
  const { data: updatedLocation, error: updateError } = await supabase
    .from('map_locations')
    .update({
      is_discovered: true,
      discovered_by: colonyId
    })
    .eq('id', locationId)
    .select()
    .single()

  if (updateError) {
    return { location: null, rewards: null, error: updateError.message }
  }

  return { location: updatedLocation, rewards, error: null }
}