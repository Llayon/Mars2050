import { getServerClient } from '@/domains/resource/resource.server'

/**
 * Execute a trade between two colonies.
 * Deducts offered resources from seller, adds requested resources to buyer.
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
 * Execute an attack between two colonies.
 * Returns combat result and any stolen resources.
 */
export async function executeAttack(
  attackerColonyId: string,
  defenderColonyId: string,
  unitCount: number
): Promise<{ success: boolean; error?: string; message?: string; stolen?: Record<string, number> }> {
  const supabase = getServerClient()

  const { data: defenderResources } = await supabase
    .from('resources')
    .select('type, amount')
    .eq('colony_id', defenderColonyId)

  if (!defenderResources) {
    return { success: false, error: 'Failed to fetch defender resources' }
  }

  const attackerPower = unitCount * 10
  const defenderPower = defenderResources.reduce((sum: number, r: { amount: number }) => sum + r.amount, 0) / 100
  const attackerWins = attackerPower > defenderPower

  if (attackerWins) {
    const stolen: Record<string, number> = {}
    for (const r of defenderResources) {
      const amount = Math.floor(r.amount * 0.1)
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

    return { success: true, message: 'Атака успешна! Ресурсы захвачены.', stolen }
  }

  return { success: false, message: 'Атака отбита! Вы потеряли часть армии.' }
}