import { getServerClient } from '@/domains/resource/resource.server'
import { STARTING_RESOURCES } from '@/domains/building/building.config'
import { isMissingResourceCapacityError } from '@/domains/resource/resource.schema-compat'
import { getBaseResourceCapacity } from '@/domains/resource/resource.storage'
import { recalculateResources } from '@/domains/resource/resource.service'
import { generateColonyTerrain } from './colony-terrain.generator'
import type { BuildingRow } from '@/domains/building/building.types'
import type { PopulationState } from '@/domains/population/population.types'
import type { ResourceRow } from '@/domains/resource/resource.types'
import type { Colony, ColonyBootstrapPayload } from './colony.types'
import type { TerrainGrid } from './colony-terrain.types'

/**
 * Initialize starting resources for a new colony.
 * Skips if resources already exist.
 * @param colonyId - Colony ID to initialize
 * @returns Success status with count of resources created
 */
export async function initColonyResources(colonyId: string): Promise<{ success: boolean; error?: string; count?: number }> {
  const supabase = getServerClient()

  const { data: existing, error: existingError } = await supabase
    .from('resources')
    .select('type')
    .eq('colony_id', colonyId)

  if (existingError) return { success: false, error: existingError.message }

  const existingTypes = new Set((existing || []).map(row => (row as { type: string }).type))
  const missingEntries = Object.entries(STARTING_RESOURCES).filter(([type]) => !existingTypes.has(type))

  if (missingEntries.length === 0) {
    return { success: true, error: undefined, count: 0 }
  }

  const rows = missingEntries.map(([type, amount]) => ({
    colony_id: colonyId,
    type,
    amount,
    capacity: Math.max(amount, getBaseResourceCapacity(type)),
    production_rate: 0,
    consumption_rate: 0
  }))

  const { error } = await supabase.from('resources').insert(rows)
  if (error) {
    if (!isMissingResourceCapacityError(error)) return { success: false, error: error.message }
    const legacyRows = rows.map(row => ({
      colony_id: row.colony_id,
      type: row.type,
      amount: row.amount,
      production_rate: row.production_rate,
      consumption_rate: row.consumption_rate,
    }))
    const { error: legacyError } = await supabase.from('resources').insert(legacyRows)
    if (legacyError) return { success: false, error: legacyError.message }
  }

  return { success: true, count: rows.length }
}

/**
 * Ensures a colony has a deterministic terrain grid.
 */
export async function ensureColonyTerrain(colonyId: string): Promise<{ success: boolean; error?: string; terrainGrid?: TerrainGrid; updated?: boolean }> {
  const supabase = getServerClient()
  const { data, error } = await supabase.from('colonies').select('terrain_grid').eq('id', colonyId).single()

  if (error || !data) return { success: false, error: error?.message || 'Colony not found' }

  const existing = (data as { terrain_grid?: unknown }).terrain_grid
  if (Array.isArray(existing) && existing.length > 0) {
    return { success: true, terrainGrid: existing as TerrainGrid, updated: false }
  }

  const terrainGrid = generateColonyTerrain(colonyId)
  const { error: updateError } = await supabase.from('colonies').update({ terrain_grid: terrainGrid }).eq('id', colonyId)
  if (updateError) return { success: false, error: updateError.message }

  return { success: true, terrainGrid, updated: true }
}

/**
 * Initialize starting population for a colony.
 */
export async function initColonyPopulation(colonyId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getServerClient()
  const { data: existing } = await supabase.from('population').select('id').eq('colony_id', colonyId).single()
  
  if (existing) {
    return { success: true }
  }

  const { error } = await supabase.from('population').insert({
    colony_id: colonyId,
    workers: 10,
    technicians: 0,
    scientists: 0,
    directors: 0,
    happiness_workers: 100,
    happiness_technicians: 100,
    happiness_scientists: 100,
    happiness_directors: 100
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Reads the current colony render snapshot without recalculation or lazy ticks.
 * Falls back to full bootstrap when legacy data is missing.
 */
export async function getColonyBootstrapFastData(colonyId: string): Promise<{ data?: ColonyBootstrapPayload; error?: string }> {
  const supabase = getServerClient()

  const [
    { data: colony, error: colonyError },
    { data: resources, error: resourcesError },
    { data: buildings, error: buildingsError },
    { data: population, error: populationError }
  ] = await Promise.all([
    supabase.from('colonies').select('*').eq('id', colonyId).single(),
    supabase.from('resources').select('*').eq('colony_id', colonyId),
    supabase.from('buildings').select('*').eq('colony_id', colonyId).order('created_at', { ascending: true }),
    supabase.from('population').select('*').eq('colony_id', colonyId).maybeSingle()
  ])

  const fetchError = colonyError?.message || resourcesError?.message || buildingsError?.message || populationError?.message
  if (fetchError || !colony) return { error: fetchError || 'Colony not found' }

  const terrainGrid = (colony as { terrain_grid?: unknown }).terrain_grid
  const hasTerrain = Array.isArray(terrainGrid) && terrainGrid.length > 0
  if (!hasTerrain || !resources || resources.length === 0 || !population) {
    return getColonyBootstrapData(colonyId)
  }

  return {
    data: {
      colony: colony as unknown as Colony,
      resources: resources as ResourceRow[],
      buildings: (buildings || []) as BuildingRow[],
      population: population as PopulationState | null,
    }
  }
}

/**
 * Loads all data required for a fully synchronized colony render.
 * Applies lazy backfills and resource recalculation before returning rows.
 */
export async function getColonyBootstrapData(colonyId: string): Promise<{ data?: ColonyBootstrapPayload; error?: string }> {
  const supabase = getServerClient()

  const [resourcesInit, populationInit, terrainInit] = await Promise.all([
    initColonyResources(colonyId),
    initColonyPopulation(colonyId),
    ensureColonyTerrain(colonyId)
  ])

  const initError = resourcesInit.error || populationInit.error || terrainInit.error
  if (initError) return { error: initError }

  const resources = await recalculateResources(colonyId)
  if (!resources) return { error: 'Failed to recalculate resources' }

  const [
    { data: colony, error: colonyError },
    { data: buildings, error: buildingsError },
    { data: population, error: populationError }
  ] = await Promise.all([
    supabase.from('colonies').select('*').eq('id', colonyId).single(),
    supabase.from('buildings').select('*').eq('colony_id', colonyId).order('created_at', { ascending: true }),
    supabase.from('population').select('*').eq('colony_id', colonyId).maybeSingle()
  ])

  const fetchError = colonyError?.message || buildingsError?.message || populationError?.message
  if (fetchError || !colony) return { error: fetchError || 'Colony not found' }

  return {
    data: {
      colony: colony as unknown as Colony,
      resources: resources as ResourceRow[],
      buildings: (buildings || []) as BuildingRow[],
      population: population as PopulationState | null,
    }
  }
}
