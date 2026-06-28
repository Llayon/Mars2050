import { getServerClient } from '@/domains/resource/resource.server'
import type { BuildingCreateDTO, BuildingResponse, BuildingRow } from './building.types'
import { BUILDING_TYPES, BUILDING_PRODUCTION_MAP, BUILDING_CONSUMPTION_MAP } from './building.config'
import { updateResourceRate, PRODUCTION_TYPE } from './building.utils'
import { validateBuildingPlacement } from './building-placement'
import type { TerrainCell } from '@/domains/colony/colony-terrain.types'

/**
 * Creates a new building for a colony.
 * Checks cost, deducts resources, creates building, updates rates.
 * @param dto - Building creation data (colonyId, type, name)
 * @returns Created building row or error
 */
export async function createBuilding(dto: BuildingCreateDTO): Promise<BuildingResponse> {
  const supabase = getServerClient()
  const config = BUILDING_TYPES[dto.type]

  if (!config) {
    return { building: null, error: 'Invalid building type', status: 400 }
  }

  // 1. Placement validation
  if (dto.x !== undefined && dto.y !== undefined) {
    const { data: colony } = await supabase
      .from('colonies')
      .select('terrain_grid, unlocked_radius')
      .eq('id', dto.colonyId)
      .single()

    if (!colony) {
      return { building: null, error: 'Колония не найдена', status: 404 }
    }

    const { data: buildings } = await supabase
      .from('buildings')
      .select('type, x, y')
      .eq('colony_id', dto.colonyId)
      .not('x', 'is', null)
      .not('y', 'is', null)

    const mappedBuildings = (buildings || []).map(b => {
      const cfg = BUILDING_TYPES[b.type as string]
      return { x: b.x as number, y: b.y as number, width: cfg?.width || 1, height: cfg?.height || 1 }
    })

    const validation = validateBuildingPlacement({
      x: dto.x,
      y: dto.y,
      width: config.width || 1,
      height: config.height || 1,
      unlockedRadius: colony.unlocked_radius || 5,
      terrainGrid: (colony.terrain_grid as TerrainCell[]) || [],
      occupiedCells: mappedBuildings
    })

    if (!validation.valid) {
      return { building: null, error: validation.error || 'Invalid placement', status: 400 }
    }
  }

  // 2. Check if colony has enough resources
  const { data: resources, error: resourcesError } = await supabase
    .from('resources')
    .select('type, amount')
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

  // 3. Deduct building cost with Optimistic Concurrency Control
  const deductedResources: string[] = []
  let deductionFailed = false

  for (const [resourceType, cost] of Object.entries(config.cost)) {
    const currentAmount = resourceMap[resourceType] || 0
    const newAmount = currentAmount - cost

    const { data: updated, error: updateError } = await supabase
      .from('resources')
      .update({ amount: Math.max(0, newAmount) })
      .eq('colony_id', dto.colonyId)
      .eq('type', resourceType)
      .eq('amount', currentAmount) // OCC to prevent race conditions
      .select('id')

    if (updateError || !updated || updated.length === 0) {
      console.error('Failed to deduct resource (race condition):', resourceType)
      deductionFailed = true
      break
    }
    deductedResources.push(resourceType)
  }

  if (deductionFailed) {
    // Rollback successful deductions
    for (const resType of deductedResources) {
      const cost = config.cost[resType as keyof typeof config.cost]
      const current = resourceMap[resType] || 0
      await supabase
        .from('resources')
        .update({ amount: current })
        .eq('colony_id', dto.colonyId)
        .eq('type', resType)
    }
    return { building: null, error: 'Транзакция отменена: ресурсы были изменены другим процессом. Попробуйте снова.', status: 409 }
  }

  // 3. Create building record
  const { data: building, error } = await supabase
    .from('buildings')
    .insert({
      colony_id: dto.colonyId,
      type: dto.type,
      name: dto.name,
      level: 1,
      is_active: true,
      x: dto.x,
      y: dto.y,
      group_id: dto.group_id
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
 * @param buildingId - Building ID to delete
 * @param colonyId - Colony ID owning the building
 * @returns Success status or error message
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
 * @param colonyId - Colony ID
 * @returns Array of building rows
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