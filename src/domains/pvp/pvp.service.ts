import { getServerClient } from '@/domains/resource/resource.server'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { UnitRow } from '@/domains/combat/combat.types'
import type { BattleTick } from '@/domains/combat/combat.types'

/**
 * Execute a trade between two colonies.
 * Deducts offered resources from seller, adds requested resources to buyer.
 * @param fromColonyId - Selling colony ID
 * @param toColonyId - Buying colony ID
 * @param offerResources - Resources the seller offers
 * @param requestResources - Resources the buyer requests
 * @returns Success status or error message
 */
export async function executeTrade(
  fromColonyId: string,
  toColonyId: string,
  offerResources: Record<string, number>,
  requestResources?: Record<string, number>
): Promise<{ success: boolean; error?: string; message?: string }> {
  const supabase = getServerClient()

  // Verify colonies exist
  const { data: colonies } = await supabase
    .from('colonies')
    .select('id')
    .in('id', [fromColonyId, toColonyId])

  if (!colonies || colonies.length !== 2) {
    return { success: false, error: 'Invalid colonies' }
  }

  // Check seller has enough resources
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
  }

  // Subtract from seller
  for (const [resourceType, amount] of Object.entries(offerResources)) {
    const { data: current } = await supabase
      .from('resources')
      .select('amount')
      .eq('colony_id', fromColonyId)
      .eq('type', resourceType)
      .single()

    if (current) {
      await supabase
        .from('resources')
        .update({ amount: Math.max(0, current.amount - amount) })
        .eq('colony_id', fromColonyId)
        .eq('type', resourceType)
    }
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
 * @param attackerColonyId - Attacking colony ID
 * @param defenderColonyId - Defending colony ID
 * @returns Combat result with stolen resources on success
 */
export async function executeAttack(
  attackerColonyId: string,
  defenderColonyId: string,
  attackerUnitsPlacement?: { unitId: string, x: number, y: number }[]
): Promise<{ 
  success: boolean; 
  error?: string; 
  message?: string; 
  stolen?: Record<string, number>;
  logs?: BattleTick[];
  attackerUnits?: UnitRow[];
  defenderUnits?: UnitRow[];
}> {
  const supabase = getServerClient()

  // 1. Fetch units for both sides
  const { data: attackerUnits } = await supabase.from('units').select('*').eq('colony_id', attackerColonyId)
  const { data: defenderUnits } = await supabase.from('units').select('*').eq('colony_id', defenderColonyId)

  if (!attackerUnits || attackerUnits.length === 0) {
    return { success: false, error: 'У вас нет армии для атаки!' }
  }

  // Override attacker unit coordinates with placement data if provided
  if (attackerUnitsPlacement && attackerUnitsPlacement.length > 0) {
    const placementMap = new Map(attackerUnitsPlacement.map(p => [p.unitId, p]))
    for (const u of attackerUnits) {
      const p = placementMap.get(u.id)
      if (p) {
        u.grid_x = p.x
        u.grid_y = p.y
      }
    }
  }

  // 2. Simulate battle
  const battleResult = simulateBattle(attackerUnits as UnitRow[], (defenderUnits || []) as UnitRow[])

  // 3. Delete dead units from the database
  const deadAttackerIds = attackerUnits
    .filter(u => !battleResult.survivors.some(s => s.id === u.id))
    .map(u => u.id)
  const deadDefenderIds = (defenderUnits || [])
    .filter(u => !battleResult.survivors.some(s => s.id === u.id))
    .map(u => u.id)

  const allDeadIds = [...deadAttackerIds, ...deadDefenderIds]
  if (allDeadIds.length > 0) {
    await supabase.from('units').delete().in('id', allDeadIds)
  }

  // 4. Update HP for survivors (optional, but good for persistence)
  for (const survivor of battleResult.survivors) {
    if (survivor.hp < survivor.maxHp) {
      await supabase.from('units').update({ hp_current: survivor.hp }).eq('id', survivor.id)
    }
  }

  // 5. Handle resources if attacker wins
  let stolen: Record<string, number> = {}
  if (battleResult.winner === 'attacker') {
    const { data: defenderResources } = await supabase
      .from('resources')
      .select('type, amount')
      .eq('colony_id', defenderColonyId)

    if (defenderResources) {
      for (const r of defenderResources) {
        const amount = Math.floor(r.amount * 0.1) // Steal 10%
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

  // 6. Save battle log
  await supabase.from('battles').insert({
    attacker_colony_id: attackerColonyId,
    defender_colony_id: defenderColonyId,
    winner: battleResult.winner,
    attacker_units: attackerUnits,
    defender_units: defenderUnits || [],
    battle_log: [],
    rewards: stolen
  })

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
    attackerUnits,
    defenderUnits: defenderUnits || []
  }
}