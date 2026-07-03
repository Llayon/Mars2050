import type { SupabaseClient, User } from '@supabase/supabase-js'
import { STARTING_RESOURCES } from '@/domains/building/building.config'
import { generateColonyTerrain } from '@/domains/colony/colony-terrain.generator'
import { getServerClient } from '@/domains/resource/resource.server'
import { isMissingResourceCapacityError } from '@/domains/resource/resource.schema-compat'
import { getBaseResourceCapacity } from '@/domains/resource/resource.storage'
import {
  E2E_COLONY_NAME,
  E2E_USER_EMAIL,
  E2E_USER_PASSWORD,
  E2E_USERNAME,
} from './e2e.config'
import type { E2eSessionPayload, E2eSessionResult } from './e2e.types'

interface IdRow {
  id: string
}

interface ServiceError {
  message: string
}

function errorMessage(error: ServiceError | null | undefined, fallback: string): string {
  return error?.message || fallback
}

async function findAuthUserByEmail(supabase: SupabaseClient): Promise<User | null> {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) return null
  return data.users.find(user => user.email === E2E_USER_EMAIL) ?? null
}

async function getOrCreateE2eUser(supabase: SupabaseClient): Promise<{ user: User | null; error: string | null }> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', E2E_USERNAME)
    .maybeSingle()

  if (profileError) return { user: null, error: profileError.message }

  const profileRow = profile as IdRow | null
  if (profileRow?.id) {
    const { data, error } = await supabase.auth.admin.getUserById(profileRow.id)
    if (data.user) return { user: data.user, error: null }
    if (error) return { user: null, error: error.message }
  }

  const created = await supabase.auth.admin.createUser({
    email: E2E_USER_EMAIL,
    password: E2E_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { e2e: true },
  })

  let user = created.data.user
  if (!user && created.error) {
    user = await findAuthUserByEmail(supabase)
  }
  if (!user) {
    return { user: null, error: errorMessage(created.error, 'Failed to create e2e user') }
  }

  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert({ id: user.id, username: E2E_USERNAME, avatar_url: null }, { onConflict: 'id' })

  if (upsertError) return { user: null, error: upsertError.message }
  return { user, error: null }
}

async function ensureE2eColony(supabase: SupabaseClient, userId: string): Promise<{ colonyId: string | null; error: string | null }> {
  const { data: existing, error: existingError } = await supabase
    .from('colonies')
    .select('id')
    .eq('user_id', userId)
    .eq('name', E2E_COLONY_NAME)
    .maybeSingle()

  if (existingError) return { colonyId: null, error: existingError.message }
  const existingRow = existing as IdRow | null
  if (existingRow?.id) return { colonyId: existingRow.id, error: null }

  const { data: colony, error } = await supabase
    .from('colonies')
    .insert({
      user_id: userId,
      name: E2E_COLONY_NAME,
      level: 1,
      experience: 0,
      unlocked_radius: 5,
    })
    .select('id')
    .single()

  if (error || !colony) return { colonyId: null, error: errorMessage(error, 'Failed to create e2e colony') }
  return { colonyId: (colony as IdRow).id, error: null }
}

async function deleteColonyRows(supabase: SupabaseClient, colonyId: string): Promise<string | null> {
  const colonyTables = ['buildings', 'resources', 'events', 'pending_events', 'work_orders', 'units'] as const

  for (const table of colonyTables) {
    const { error } = await supabase.from(table).delete().eq('colony_id', colonyId)
    if (error) return error.message
  }

  const battleDelete = await supabase
    .from('battles')
    .delete()
    .or(`attacker_colony_id.eq.${colonyId},defender_colony_id.eq.${colonyId}`)
  if (battleDelete.error) return battleDelete.error.message

  const mapReset = await supabase
    .from('map_locations')
    .update({ is_discovered: false, discovered_by: null })
    .eq('discovered_by', colonyId)
  return mapReset.error?.message ?? null
}

async function seedE2eColony(supabase: SupabaseClient, colonyId: string): Promise<string | null> {
  const now = new Date().toISOString()
  const terrainGrid = generateColonyTerrain(colonyId)
  const colonyUpdate = await supabase
    .from('colonies')
    .update({
      name: E2E_COLONY_NAME,
      level: 1,
      experience: 0,
      terrain_grid: terrainGrid,
      unlocked_radius: 5,
      last_calc_at: now,
      updated_at: now,
    })
    .eq('id', colonyId)
  if (colonyUpdate.error) return colonyUpdate.error.message

  const resources = Object.entries(STARTING_RESOURCES).map(([type, amount]) => ({
    colony_id: colonyId,
    type,
    amount,
    capacity: Math.max(amount, getBaseResourceCapacity(type)),
    production_rate: 0,
    consumption_rate: 0,
    updated_at: now,
  }))

  const resourceSeed = await supabase.from('resources').upsert(resources, { onConflict: 'colony_id,type' })
  if (resourceSeed.error) {
    if (!isMissingResourceCapacityError(resourceSeed.error)) return resourceSeed.error.message
    const legacyResources = resources.map(row => ({
      colony_id: row.colony_id,
      type: row.type,
      amount: row.amount,
      production_rate: row.production_rate,
      consumption_rate: row.consumption_rate,
      updated_at: row.updated_at,
    }))
    const legacySeed = await supabase.from('resources').upsert(legacyResources, { onConflict: 'colony_id,type' })
    if (legacySeed.error) return legacySeed.error.message
  }

  const populationSeed = await supabase.from('population').upsert({
    colony_id: colonyId,
    workers: 10,
    technicians: 0,
    scientists: 0,
    directors: 0,
    happiness_workers: 100,
    happiness_technicians: 100,
    happiness_scientists: 100,
    happiness_directors: 100,
    growth_progress: 0,
    updated_at: now,
  }, { onConflict: 'colony_id' })

  return populationSeed.error?.message ?? null
}

/**
 * Creates or reuses the isolated e2e user and colony.
 * @returns Session payload for browser smoke tests.
 */
export async function getOrCreateE2eSession(): Promise<E2eSessionResult> {
  const supabase = getServerClient()
  const userResult = await getOrCreateE2eUser(supabase)
  if (userResult.error || !userResult.user) return { data: null, error: userResult.error || 'Missing e2e user' }

  const colonyResult = await ensureE2eColony(supabase, userResult.user.id)
  if (colonyResult.error || !colonyResult.colonyId) {
    return { data: null, error: colonyResult.error || 'Missing e2e colony' }
  }

  const data: E2eSessionPayload = {
    user: { id: userResult.user.id, email: userResult.user.email || E2E_USER_EMAIL },
    colonyId: colonyResult.colonyId,
  }
  return { data, error: null }
}

/**
 * Resets only the isolated e2e colony to deterministic starting state.
 * @returns Session payload for the reset colony.
 */
export async function resetE2eSession(): Promise<E2eSessionResult> {
  const supabase = getServerClient()
  const session = await getOrCreateE2eSession()
  if (session.error || !session.data) return session

  const clearError = await deleteColonyRows(supabase, session.data.colonyId)
  if (clearError) return { data: null, error: clearError }

  const seedError = await seedE2eColony(supabase, session.data.colonyId)
  if (seedError) return { data: null, error: seedError }

  return session
}
