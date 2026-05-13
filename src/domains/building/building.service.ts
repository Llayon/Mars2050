import { getServerClient } from '@/domains/resource/resource.server'
import type { BuildingCreateDTO, BuildingResponse, BuildingRow } from './building.types'
import { BUILDING_TYPES, BUILDING_PRODUCTION_MAP, BUILDING_CONSUMPTION_MAP } from './building.config'
import { updateResourceRate, PRODUCTION_TYPE } from './building.utils'

/**
 * Creates a new building for a colony.
 * Checks cost, deducts resources, creates building, updates rates.
 */
export async function createBuilding(dto: BuildingCreateDTO): Promise<BuildingResponse> {
  const supabase = getServerClient()
  const config = BUILDING_TYPES[dto.type]

  if (!config) {
    return { building: null, error: 'Invalid building type', status: 400 }
  }

  // 1. Check if colony has enough resources
  const { data: resources, error: resourcesError } = await supabase
    .from('resources')
    .select('*')
    .eq('colony_id', dto.colonyId)

  if (resourcesError || !resources) {
    return { building: null, error: 'Failed to fetch resources', status: 500 }
  }

  const resourceMap: Record<string, number> = {}
  for (const r of resources) {
    resourceMap[r.type] = r.amount
  }

  for (const [resourceType, cost] of Object.entries(config.cost)) {
    const available = resourceMap[resourceType] || 0
    if (available < cost) {
      return {
        building: null,
        error: `Not enough ${resourceType}. Need ${cost}, have ${Math.floor(available)}`,
        status: 400
      }
    }
  }

  // 2. Deduct building cost
  for (const [resourceType, cost] of Object.entries(config.cost)) {
    const currentAmount = resourceMap[resourceType] || 0
    const newAmount = currentAmount - cost

    const { error: updateError } = await supabase
      .from('resources')
      .update({ amount: Math.max(0, newAmount) })
      .eq('colony_id', dto.colonyId)
      .eq('type', resourceType)

    if (updateError) {
      console.error('Failed to deduct resource:', resourceType, updateError)
    }
  }

  // 3. Create building record
  const { data: building, error } = await supabase
    .from('buildings')
    .insert({
      colony_id: dto.colonyId,
      type: dto.type,
      name: dto.name,
      level: 1,
      is_active: true
    })
    .select()
    .single()

  if (error) {
    return { building: null, error: error.message, status: 500 }
  }

  // 4. Update production rate
  const productionResource = PRODUCTION_TYPE[dto.type]
  const productionBonus = BUILDING_PRODUCTION_MAP[dto.type] || 0
  if (productionResource && productionBonus > 0) {
    await updateResourceRate(dto.colonyId, productionResource, 'production_rate', productionBonus)
  }

  // 5. Update consumption rates
  const consumption = BUILDING_CONSUMPTION_MAP[dto.type] || {}
  for (const [resourceKey, amount] of Object.entries(consumption)) {
    await updateResourceRate(dto.colonyId, resourceKey, 'consumption_rate', amount as number)
  }

  return { building, error: null, status: 201 }
}

/**
 * Deletes a building and reverts its production/consumption effects.
 */
export async function deleteBuilding(buildingId: string, colonyId: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = getServerClient()

  const { data: building } = await supabase
    .from('buildings')
    .select('type')
    .eq('id', buildingId)
    .single()

  const { error } = await supabase
    .from('buildings')
    .delete()
    .eq('id', buildingId)

  if (error) {
    return { success: false, error: error.message }
  }

  if (building) {
    const productionResource = PRODUCTION_TYPE[building.type as string]
    const productionAmount = (BUILDING_PRODUCTION_MAP as Record<string, number>)[building.type as string] || 0

    if (productionResource && productionAmount > 0) {
      await updateResourceRate(colonyId, productionResource, 'production_rate', -productionAmount)
    }

    const consumption = (BUILDING_CONSUMPTION_MAP as Record<string, Record<string, number>>)[building.type as string] || {}
    for (const [resourceKey, amount] of Object.entries(consumption)) {
      await updateResourceRate(colonyId, resourceKey, 'consumption_rate', -(amount as number))
    }
  }

  return { success: true, error: null }
}

/**
 * Gets all buildings for a colony.
 */
export async function getBuildings(colonyId: string): Promise<BuildingRow[]> {
  const supabase = getServerClient()

  const { data, error } = await supabase
    .from('buildings')
    .select('*')
    .eq('colony_id', colonyId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('getBuildings error:', error)
    return []
  }

  return data || []
}