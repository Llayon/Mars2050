import { getServerClient } from '@/domains/resource/resource.server'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { UnitRow } from '@/domains/combat/combat.types'
import type { DeploymentPoint } from '@/domains/combat/combat.deployment'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AttackResult } from './pvp.types'
import { loadOwnedColony } from './pvp.ownership'
import {
  computeBattlePersistence,
} from './pvp.persistence'
import {
  validateOffer,
  applyTrade,
  applyAttackRewards,
} from './pvp.resources'
import {
  loadAuthorizedBattle,
  loadBattleWithSnapshot,
  getAttackCooldownSeconds,
  persistBattleWithSnapshot,
  type BattleWithSnapshot,
} from './pvp.replay'

/**
 * Default minimum seconds between attacks from the same colony.
 * The simulation is a heavy operation; the cooldown prevents spam.
 */
export const ATTACK_COOLDOWN_SECONDS = 30

/**
 * Execute a trade between two colonies.
 * Deducts offered resources from seller, adds requested resources to buyer.
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
  const owned = await loadOwnedColony(authClient, fromColonyId, userId)
  if (!owned) {
    return { success: false, error: 'You do not own the seller colony' }
  }

  const supabase = getServerClient()
  const { data: colonies } = await supabase
    .from('colonies')
    .select('id')
    .in('id', [fromColonyId, toColonyId])
  if (!colonies || colonies.length !== 2) {
    return { success: false, error: 'Invalid colonies' }
  }

  const missing = await validateOffer(fromColonyId, offerResources)
  const missingKeys = Object.keys(missing)
  if (missingKeys.length > 0) {
    return { success: false, error: `Not enough ${missingKeys[0]}` }
  }

  await applyTrade(fromColonyId, toColonyId, offerResources, requestResources)
  return { success: true, message: 'Торговля завершена!' }
}

import { generateNpcUnits } from './pvp.practice'

/**
 * Execute an attack between two colonies.
 * Validates ownership, applies the cooldown check, simulates the battle,
 * applies persistence (unit HP / dead removal), and writes the replay
 * snapshot.
 */
export async function executeAttack(
  authClient: SupabaseClient,
  userId: string,
  attackerColonyId: string,
  defenderColonyId: string,
  clientSeed?: number,
  attackerUnitsPlacement?: DeploymentPoint[]
): Promise<AttackResult> {
  const owned = await loadOwnedColony(authClient, attackerColonyId, userId)
  if (!owned) {
    return { success: false, error: 'You do not own the attacker colony' }
  }

  const isPractice = defenderColonyId.startsWith('npc_')

  const cooldownRemaining = await getAttackCooldownSeconds(
    attackerColonyId,
    ATTACK_COOLDOWN_SECONDS
  )
  if (!isPractice && cooldownRemaining > 0) {
    return {
      success: false,
      error: `Attack cooldown active: ${cooldownRemaining}s remaining`,
      cooldownRemaining,
    }
  }

  const supabase = getServerClient()
  const { data: attackerUnits } = await supabase
    .from('units').select('*').eq('colony_id', attackerColonyId)
    
  let defenderUnits: UnitRow[] = []
  if (isPractice) {
    defenderUnits = generateNpcUnits(defenderColonyId)
  } else {
    const { data } = await supabase
      .from('units').select('*').eq('colony_id', defenderColonyId)
    defenderUnits = data || []
  }

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
    clientSeed,
    [],
    [],
    [],
    { maxTicks: 1000, timeoutPolicy: 'defender_holds' }
  )

  let stolen: Record<string, number> = {}
  let battleId: string | undefined = undefined

  if (!isPractice) {
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

    stolen = battleResult.winner === 'attacker'
      ? await applyAttackRewards(attackerColonyId, defenderColonyId)
      : {}

    const snapId = await persistBattleWithSnapshot(
      {
        attacker_colony_id: attackerColonyId,
        defender_colony_id: defenderColonyId,
        winner: battleResult.winner,
        attacker_units: attackerUnits as unknown as Record<string, unknown>,
        defender_units: (defenderUnits || []) as unknown as Record<string, unknown>,
        rewards: stolen,
      },
      {
        seed: battleResult.seed ?? clientSeed ?? 0,
        initial_state: battleResult.initialState as unknown as Record<string, unknown>,
        log: battleResult.logs as unknown as Record<string, unknown>,
        simulationVersion: battleResult.simulationVersion,
        simulationRevision: battleResult.simulationRevision,
        terminationReason: battleResult.terminationReason,
        elapsedTicks: battleResult.elapsedTicks,
      }
    )
    if (snapId) battleId = snapId
  }

  let winMsg =
    battleResult.winner === 'attacker'
      ? 'Атака успешна! Враг разбит, ресурсы захвачены.'
      : battleResult.winner === 'defender'
        ? 'Атака провалилась! Защитники отбились.'
        : 'Ничья! Обе стороны понесли тяжелые потери.'
        
  if (isPractice) {
    winMsg = `[PRACTICE] ${winMsg} (Юниты не потеряны)`
  }

  return {
    success: true,
    message: winMsg,
    stolen,
    logs: battleResult.logs,
    obstacles: battleResult.obstacles,
    initialState: battleResult.initialState,
    attackerUnits,
    defenderUnits: defenderUnits || [],
    battleId: battleId ?? undefined,
    seed: battleResult.seed,
    metrics: undefined,
    simulationVersion: battleResult.simulationVersion,
    simulationRevision: battleResult.simulationRevision,
    terminationReason: battleResult.terminationReason,
    elapsedTicks: battleResult.elapsedTicks,
  }
}

/**
 * Load a battle with its snapshot, but only if the user is a participant.
 * Returns null when the battle does not exist OR the user is not a
 * participant (intentionally indistinguishable to prevent existence leaks).
 */
export async function fetchAuthorizedBattle(
  authClient: SupabaseClient,
  battleId: string
): Promise<BattleWithSnapshot | null> {
  return loadAuthorizedBattle(authClient, battleId)
}

/**
 * Internal helper: load a battle without auth (service_role). Used by tests
 * and admin tooling. Not exposed to the API layer.
 */
export async function fetchBattleInternal(
  battleId: string
): Promise<BattleWithSnapshot | null> {
  return loadBattleWithSnapshot(battleId)
}
