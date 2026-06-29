import { getServerClient } from '@/domains/resource/resource.server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { BuildingCreateDTO, BuildingResponse, BuildingRow, BuildingTypeKey } from './building.types'
import { BUILDING_TYPES } from './building.config'
import { validateBuildingPlacement } from './building-placement'
import { recalculateResources } from '@/domains/resource/resource.service'
import type { TerrainCell } from '@/domains/colony/colony-terrain.types'
import type { PopulationState } from '@/domains/population/population.types'

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
    const { data: colony, error: colonyError } = await supabase
      .from('colonies')
      .select('terrain_grid, unlocked_radius')
      .eq('id', dto.colonyId)
      .single()

    if (colonyError || !colony) {
      console.error('Failed to load colony in createBuilding:', colonyError)
      return {
        building: null,
        error: colonyError ? `Колония не найдена: ${colonyError.message}` : 'Колония не найдена',
        status: 404
      }
    }

    const { data: buildings } = await supabase
      .from('buildings')
      .select('type, x, y')
      .eq('colony_id', dto.colonyId)
      .not('x', 'is', null)
      .not('y', 'is', null)

    const mappedBuildings = (buildings || []).map(b => {
      const cfg = BUILDING_TYPES[b.type as BuildingTypeKey]
      return { x: b.x as number, y: b.y as number, width: cfg?.width || 1, height: cfg?.height || 1 }
    })

    const validation = validateBuildingPlacement({
      x: dto.x,
      y: dto.y,
      width: config.width || 1,
      height: config.height || 1,
      unlockedRadius: colony.unlocked_radius || 5,
      terrainGrid: (colony.terrain_grid as TerrainCell[]) || [],
      occupiedCells: mappedBuildings,
      requiredTerrain: config.requiresTerrain
    })

    if (!validation.valid) {
      return { building: null, error: validation.error || 'Invalid placement', status: 400 }
    }
  }

  // 1.5 Check unlock prerequisites
  if (config.unlockedByTier) {
    const { data: population } = await supabase
      .from('population')
      .select('*')
      .eq('colony_id', dto.colonyId)
      .single()
      
    if (!population) {
      return { building: null, error: 'Population data missing', status: 400 }
    }
    
    const tierField = `${config.unlockedByTier}s` as keyof PopulationState
    const popCount = (population as PopulationState)[tierField] || 0
    if (popCount === 0) {
      return { building: null, error: `Requires at least one ${config.unlockedByTier} to build`, status: 403 }
    }
  }

  // 2. Execute atomic placement transaction in database (1 roundtrip)
  const { data: txResult, error: txError } = await supabase.rpc('create_building_transaction', {
    p_colony_id: dto.colonyId,
    p_building_type: dto.type,
    p_building_name: dto.name,
    p_x: dto.x ?? 10,
    p_y: dto.y ?? 10,
    p_costs: config.cost,
    p_group_id: dto.group_id || null
  })

  if (txError || !txResult) {
    return { building: null, error: txError?.message || 'Database transaction failed', status: 500 }
  }

  const result = txResult as { success: boolean; building?: BuildingRow; error?: string }
  if (!result.success) {
    return { building: null, error: result.error || 'Transaction failed', status: 400 }
  }

  // 3. Trigger full resource recalculation
  await recalculateResources(dto.colonyId)

  return { building: result.building || null, error: null, status: 201 }
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
    await recalculateResources(colonyId)
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

/**
 * Verifies if a building belongs to a colony.
 * @param authClient - The authenticated Supabase client
 * @param buildingId - The building ID to check
 * @param colonyId - The colony ID to check against
 * @returns Promise resolving to true if owned, false otherwise
 */
export async function verifyBuildingOwnership(
  authClient: SupabaseClient,
  buildingId: string,
  colonyId: string
): Promise<boolean> {
  const { data, error } = await authClient
    .from('buildings')
    .select('colony_id')
    .eq('id', buildingId)
    .maybeSingle()

  if (error || !data) return false
  return data.colony_id === colonyId
}
