import type { SimUnit, UnitRow } from '@/domains/combat/combat.types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServerClient } from '@/domains/resource/resource.server'

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

/**
 * Extract the base unit id from a simulator survivor id.
 * Squad units expand into `${baseId}_${index}` ids.
 * Returns null when the id does not have the squad suffix shape.
 */
export function squadIdFromSurvivor(survivorId: string): string | null {
  const idx = survivorId.lastIndexOf('_')
  if (idx <= 0 || idx === survivorId.length - 1) return null
  const tail = survivorId.slice(idx + 1)
  if (!/^\d+$/.test(tail)) return null
  return survivorId.slice(0, idx)
}

/**
 * A base unit is alive if at least one survivor (direct or any squad member) carries its id.
 */
export function unitIsAlive(
  baseId: string,
  survivorIdSet: Set<string>
): boolean {
  if (survivorIdSet.has(baseId)) return true
  for (const sid of survivorIdSet) {
    if (sid.startsWith(`${baseId}_`)) return true
  }
  return false
}

/**
 * Aggregate remaining HP for a base unit from its squad survivors.
 * A unit squad expands into N survivors in the simulator (id = `${baseId}_${i}`).
 * Average remaining HP ratio is applied back to the base unit, capped at maxHp.
 * Returns null if the base unit id was not part of the original unit set.
 */
export function aggregateSquadHp(
  baseId: string,
  survivors: { id: string; hp: number; maxHp: number }[]
): { hp_current: number } | null {
  const squad = survivors.filter((s) => s.id === `${baseId}_` || s.id.startsWith(`${baseId}_`))
  if (squad.length === 0) return null
  const totalRatio = squad.reduce((acc, s) => acc + (s.maxHp > 0 ? s.hp / s.maxHp : 0), 0)
  const avgRatio = totalRatio / squad.length
  const sample = squad[0]!
  const newHp = Math.min(sample.maxHp, Math.max(1, Math.round(sample.maxHp * avgRatio)))
  return { hp_current: newHp }
}

/**
 * Compute the survivors, dead unit ids, and HP updates needed after a battle.
 * Pure helper — no DB access. The caller applies the results.
 */
export function computeBattlePersistence(
  attackerUnits: UnitRow[],
  defenderUnits: UnitRow[],
  survivors: SimUnit[]
): {
  deadAttackerBaseIds: string[]
  deadDefenderBaseIds: string[]
  hpUpdates: { id: string; hp_current: number }[]
} {
  const survivorIdSet = new Set(survivors.map((s) => s.id))
  const baseIds = new Set<string>([
    ...attackerUnits.map((u) => u.id!).filter(Boolean),
    ...defenderUnits.map((u) => u.id!).filter(Boolean),
  ])

  const deadAttackerBaseIds: string[] = []
  const deadDefenderBaseIds: string[] = []
  const hpUpdates: { id: string; hp_current: number }[] = []

  for (const u of attackerUnits) {
    if (!u.id) continue
    if (!unitIsAlive(u.id, survivorIdSet)) {
      deadAttackerBaseIds.push(u.id)
    }
  }
  for (const u of defenderUnits) {
    if (!u.id) continue
    if (!unitIsAlive(u.id, survivorIdSet)) {
      deadDefenderBaseIds.push(u.id)
    }
  }

  for (const survivor of survivors) {
    const baseId = squadIdFromSurvivor(survivor.id) ?? survivor.id
    if (!baseIds.has(baseId)) continue
    if (squadIdFromSurvivor(survivor.id) === null) {
      if (survivor.hp < survivor.maxHp) {
        hpUpdates.push({ id: survivor.id, hp_current: survivor.hp })
      }
    } else {
      const agg = aggregateSquadHp(baseId, survivors)
      if (agg) hpUpdates.push({ id: baseId, hp_current: agg.hp_current })
    }
  }

  return { deadAttackerBaseIds, deadDefenderBaseIds, hpUpdates }
}

/**
 * Fetch a battle summary and its replay snapshot. Uses the service_role
 * client for the DB read — the caller (route layer) is responsible for
 * authorizing access by checking colony ownership via the user-scoped
 * client.
 * @returns null when the battle is missing
 */
export async function loadBattleWithSnapshot(
  battleId: string
): Promise<{
  battle: {
    id: string
    attacker_colony_id: string
    defender_colony_id: string
    winner: string | null
    rewards: Record<string, unknown>
    created_at: string | null
  }
  snapshot: {
    battle_id: string
    seed: number
    initial_state: Record<string, unknown>
    log: Record<string, unknown>
    version: number
    created_at: string | null
  }
} | null> {
  const supabase = getServerClient()
  const { data: battle, error: battleError } = await supabase
    .from('battles')
    .select('id, attacker_colony_id, defender_colony_id, winner, rewards, created_at')
    .eq('id', battleId)
    .single()
  if (battleError || !battle) return null

  const { data: snapshot, error: snapError } = await supabase
    .from('battle_snapshots')
    .select('battle_id, seed, initial_state, log, version, created_at')
    .eq('battle_id', battleId)
    .single()
  if (snapError || !snapshot) return null

  return {
    battle: battle as {
      id: string
      attacker_colony_id: string
      defender_colony_id: string
      winner: string | null
      rewards: Record<string, unknown>
      created_at: string | null
    },
    snapshot: snapshot as {
      battle_id: string
      seed: number
      initial_state: Record<string, unknown>
      log: Record<string, unknown>
      version: number
      created_at: string | null
    },
  }
}

/**
 * Fetch a battle with its snapshot, but only if the requesting user owns
 * one of the two participant colonies. Returns null when the battle is
 * missing or the user is not a participant.
 * @param authClient - user-scoped Supabase client (RLS scopes colonies)
 */
export async function loadAuthorizedBattle(
  authClient: SupabaseClient,
  battleId: string
): Promise<{
  battle: {
    id: string
    attacker_colony_id: string
    defender_colony_id: string
    winner: string | null
    rewards: Record<string, unknown>
    created_at: string | null
  }
  snapshot: {
    battle_id: string
    seed: number
    initial_state: Record<string, unknown>
    log: Record<string, unknown>
    version: number
    created_at: string | null
  }
} | null> {
  const result = await loadBattleWithSnapshot(battleId)
  if (!result) return null
  const { data: colonies } = await authClient
    .from('colonies')
    .select('id')
    .in('id', [result.battle.attacker_colony_id, result.battle.defender_colony_id])
  if (!colonies || colonies.length === 0) return null
  return result
}



