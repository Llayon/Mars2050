import type { SupabaseClient } from '@supabase/supabase-js'
import { getServerClient } from '@/domains/resource/resource.server'

/**
 * Snapshot version. Mirrors `CURRENT_SIMULATION_VERSION` in
 * `@/domains/combat/combat.version` — when that file is added to the
 * repository, this import can be replaced with the combat-core constant.
 * Keeping a local copy decouples the persistence layer from the core
 * version file and lets snapshots be saved even when the core file
 * is not yet committed.
 */
export const SNAPSHOT_VERSION: number = 1

export interface BattleRow {
  id: string
  attacker_colony_id: string
  defender_colony_id: string
  winner: string | null
  rewards: Record<string, unknown>
  created_at: string | null
}

export interface BattleSnapshotRow {
  battle_id: string
  seed: number
  initial_state: Record<string, unknown>
  log: Record<string, unknown>
  metrics: Record<string, unknown> | null
  version: number
  created_at: string | null
}

export interface BattleWithSnapshot {
  battle: BattleRow
  snapshot: BattleSnapshotRow
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
): Promise<BattleWithSnapshot | null> {
  const supabase = getServerClient()
  const { data: battle, error: battleError } = await supabase
    .from('battles')
    .select('id, attacker_colony_id, defender_colony_id, winner, rewards, created_at')
    .eq('id', battleId)
    .single()
  if (battleError || !battle) return null

  const { data: snapshot, error: snapError } = await supabase
    .from('battle_snapshots')
    .select('battle_id, seed, initial_state, log, metrics, version, created_at')
    .eq('battle_id', battleId)
    .single()
  if (snapError || !snapshot) return null

  return {
    battle: battle as BattleRow,
    snapshot: snapshot as BattleSnapshotRow,
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
): Promise<BattleWithSnapshot | null> {
  const result = await loadBattleWithSnapshot(battleId)
  if (!result) return null
  const { data: colonies } = await authClient
    .from('colonies')
    .select('id')
    .in('id', [result.battle.attacker_colony_id, result.battle.defender_colony_id])
  if (!colonies || colonies.length === 0) return null
  return result
}

/**
 * Check whether the attacker colony is currently on cooldown. Returns the
 * remaining seconds (0 when free to attack).
 * @param minIntervalSeconds - minimum gap between attacks from the same colony
 */
export async function getAttackCooldownSeconds(
  attackerColonyId: string,
  minIntervalSeconds: number
): Promise<number> {
  const supabase = getServerClient()
  const since = new Date(Date.now() - minIntervalSeconds * 1000).toISOString()
  const { data, error } = await supabase
    .from('battles')
    .select('created_at')
    .eq('attacker_colony_id', attackerColonyId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error || !data || data.length === 0) return 0
  const last = data[0]?.created_at
  if (!last) return 0
  const elapsed = (Date.now() - new Date(last).getTime()) / 1000
  return Math.max(0, Math.ceil(minIntervalSeconds - elapsed))
}

/**
 * Persist the battle and its snapshot. Inserts a row into `battles` and
 * a row into `battle_snapshots` referencing it. Returns the new battle id
 * or null on failure.
 *
 * `simulationVersion` is the version of the combat engine that produced
 * the result. Older replays (snapshot.version < current engine) should
 * be flagged in the UI as visually approximate.
 */
export async function persistBattleWithSnapshot(
  battle: {
    attacker_colony_id: string
    defender_colony_id: string
    winner: 'attacker' | 'defender' | 'draw' | null
    attacker_units: Record<string, unknown>
    defender_units: Record<string, unknown>
    rewards: Record<string, unknown>
  },
  snapshot: {
    seed: number
    initial_state: Record<string, unknown>
    log: Record<string, unknown>
    metrics?: Record<string, unknown>
    simulationVersion?: number
  }
): Promise<string | null> {
  const supabase = getServerClient()
  const { data: battleRow, error: battleError } = await supabase
    .from('battles')
    .insert({
      attacker_colony_id: battle.attacker_colony_id,
      defender_colony_id: battle.defender_colony_id,
      winner: battle.winner,
      attacker_units: battle.attacker_units,
      defender_units: battle.defender_units,
      battle_log: [] as unknown as Record<string, unknown>,
      rewards: battle.rewards,
    })
    .select('id')
    .single()
  if (battleError || !battleRow?.id) return null

  const version = snapshot.simulationVersion ?? SNAPSHOT_VERSION
  const { error: snapError } = await supabase.from('battle_snapshots').insert({
    battle_id: battleRow.id,
    seed: snapshot.seed,
    initial_state: snapshot.initial_state,
    log: snapshot.log,
    metrics: snapshot.metrics ?? null,
    version,
  })
  if (snapError) {
    console.error('battle_snapshot insert failed', snapError)
  }
  return battleRow.id
}
