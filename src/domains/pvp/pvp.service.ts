import { getServerClient } from '@/domains/resource/resource.server'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { UnitRow, BattleTick, Obstacle, SimUnit } from '@/domains/combat/combat.types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadOwnedColony, computeBattlePersistence } from './pvp.persistence'

/**
 * Trade resources between two colonies.
 * @param authClient - user-scoped Supabase client
 * @param userId - requesting user id, must own fromColonyId
 * @returns Success status or error message
 */
export async function executeTrade(
  authClient: SupabaseClient,
  userId: string,
  fromColonyId: string,
  toColonyId: string,
  offerResources: Record<string, number>,
  requestResources?: Record<string, number>
): Promise<{ success: boolean; error?: string; message?: string }> {
  const supabase = getServerClient()

  const owned = await loadOwnedColony(authClient, fromColonyId, userId)
  if (!owned) {
    return { success: false, error: 'You do not own the seller colony' }
  }

  // Verify both colonies exist (counterparty may belong to another user)
  const { data: colonies } = await supabase
    .from('colonies')
    .select('id')
    .in('id', [fromColonyId, toColonyId])

  if (!colonies || colonies.length !== 2) {
    return { success: false, error: 'Invalid colonies' }
  }

  // Validate and subtract from seller
  for (const [resourceType, amount] of Object.entries(offerResources)) {
    const { data: resource } = await supabase
      .from('resources')
      .select('amount')
      .eq('colony_id', fromColonyId)
      .eq('type', resourceType)
      .single()
    if (!resource || resource.amount < amount) {
      return { success: false, error: `Not enough ${resourceType}` }
    }
    await supabase
      .from('resources')
      .update({ amount: Math.max(0, resource.amount - amount) })
      .eq('colony_id', fromColonyId)
      .eq('type', resourceType)
  }

  // Add to buyer
  if (requestResources) {
    for (const [resourceType, amount] of Object.entries(requestResources)) {
      const { data: existing } = await supabase
        .from('resources')
        .select('amount')
        .eq('colony_id', toColonyId)
        .eq('type', resourceType)
        .single()
      if (existing) {
        await supabase
          .from('resources')
          .update({ amount: existing.amount + amount })
          .eq('colony_id', toColonyId)
          .eq('type', resourceType)
      }
    }
  }

  return { success: true, message: 'Торговля завершена!' }
}

/**
 * Execute an attack between two colonies using the new combat engine.
 * @param authClient - user-scoped Supabase client (used for ownership check)
 * @param userId - requesting user id, must own attackerColonyId
 * @param attackerColonyId - Attacking colony ID
 * @param defenderColonyId - Defending colony ID
 * @param clientSeed - Optional deterministic seed from the client (replay integrity)
 * @param attackerUnitsPlacement - Optional grid placement for attacker units
 * @returns Combat result with stolen resources on success
 */
export async function executeAttack(
  authClient: SupabaseClient,
  userId: string,
  attackerColonyId: string,
  defenderColonyId: string,
  clientSeed?: number,
  attackerUnitsPlacement?: { unitId: string, x: number, y: number }[]
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
  stolen?: Record<string, number>;
  logs?: BattleTick[];
  obstacles?: import('@/domains/combat/combat.types').Obstacle[];
  initialState?: import('@/domains/combat/combat.types').SimUnit[];
  attackerUnits?: UnitRow[];
  defenderUnits?: UnitRow[];
  battleId?: string;
  seed?: number;
}> {
  const supabase = getServerClient()

  const owned = await loadOwnedColony(authClient, attackerColonyId, userId)
  if (!owned) {
    return { success: false, error: 'You do not own the attacker colony' }
  }

  const { data: attackerUnits } = await supabase.from('units').select('*').eq('colony_id', attackerColonyId)
  const { data: defenderUnits } = await supabase.from('units').select('*').eq('colony_id', defenderColonyId)

  if (!attackerUnits || attackerUnits.length === 0) {
    return { success: false, error: 'У вас нет армии для атаки!' }
  }

  if (attackerUnitsPlacement && attackerUnitsPlacement.length > 0) {
    const attackerIdSet = new Set(attackerUnits.map((u) => u.id))
    for (const p of attackerUnitsPlacement) {
      if (!attackerIdSet.has(p.unitId)) {
        return { success: false, error: 'Placement refers to a unit you do not own' }
      }
    }
    const placementMap = new Map(attackerUnitsPlacement.map(p => [p.unitId, p]))
    for (const u of attackerUnits) {
      const p = placementMap.get(u.id)
      if (p) {
        u.grid_x = p.x
        u.grid_y = p.y
      }
    }
  }

  const battleResult = simulateBattle(
    attackerUnits as UnitRow[],
    (defenderUnits || []) as UnitRow[],
    clientSeed
  )

  const { deadAttackerBaseIds, deadDefenderBaseIds, hpUpdates } = computeBattlePersistence(
    attackerUnits as UnitRow[],
    (defenderUnits || []) as UnitRow[],
    battleResult.survivors
  )

  const allDeadIds = [...deadAttackerBaseIds, ...deadDefenderBaseIds]
  if (allDeadIds.length > 0) {
    await supabase.from('units').delete().in('id', allDeadIds)
  }
  for (const upd of hpUpdates) {
    await supabase.from('units').update({ hp_current: upd.hp_current }).eq('id', upd.id)
  }

  // Handle resources if attacker wins
  const stolen: Record<string, number> = {}
  if (battleResult.winner === 'attacker') {
    const { data: defenderResources } = await supabase
      .from('resources')
      .select('type, amount')
      .eq('colony_id', defenderColonyId)

    if (defenderResources) {
      for (const r of defenderResources) {
        const amount = Math.floor(r.amount * 0.1)
        if (amount > 0) {
          stolen[r.type] = amount
          await supabase
            .from('resources')
            .update({ amount: Math.max(0, r.amount - amount) })
            .eq('colony_id', defenderColonyId)
            .eq('type', r.type)

          const { data: attackerRes } = await supabase
            .from('resources')
            .select('amount')
            .eq('colony_id', attackerColonyId)
            .eq('type', r.type)
            .single()

          if (attackerRes) {
            await supabase
              .from('resources')
              .update({ amount: attackerRes.amount + amount })
              .eq('colony_id', attackerColonyId)
              .eq('type', r.type)
          }
        }
      }
    }
  }

  const { data: battleRow, error: battleError } = await supabase
    .from('battles')
    .insert({
      attacker_colony_id: attackerColonyId,
      defender_colony_id: defenderColonyId,
      winner: battleResult.winner,
      attacker_units: attackerUnits as unknown as Record<string, unknown>,
      defender_units: (defenderUnits || []) as unknown as Record<string, unknown>,
      battle_log: [] as unknown as Record<string, unknown>,
      rewards: stolen as unknown as Record<string, unknown>,
    })
    .select('id')
    .single()

  let battleId: string | undefined
  if (!battleError && battleRow?.id) {
    battleId = battleRow.id
    await supabase.from('battle_snapshots').insert({
      battle_id: battleRow.id,
      seed: battleResult.seed ?? clientSeed ?? 0,
      initial_state: battleResult.initialState as unknown as Record<string, unknown>,
      log: battleResult.logs as unknown as Record<string, unknown>,
      version: 1,
    })
  }

  const winMsg = battleResult.winner === 'attacker'
    ? 'Атака успешна! Враг разбит, ресурсы захвачены.'
    : battleResult.winner === 'defender'
      ? 'Атака провалилась! Защитники отбились.'
      : 'Ничья! Обе стороны понесли тяжелые потери.'

  return {
    success: true,
    message: winMsg,
    stolen,
    logs: battleResult.logs,
    obstacles: battleResult.obstacles,
    initialState: battleResult.initialState,
    attackerUnits,
    defenderUnits: defenderUnits || [],
    battleId,
    seed: battleResult.seed,
  }
}
