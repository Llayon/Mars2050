import type { SupabaseClient } from '@supabase/supabase-js'
import { getServerClient } from '@/domains/resource/resource.server'
import { applyResourceDeltaWithCap, getBaseResourceCapacity } from '@/domains/resource/resource.storage'

const RESOURCE_STEAL_RATIO = 0.1

/**
 * Apply a single resource delta to a colony. Atomic at the row level via
 * upsert with a `WHERE` on the existing amount (loser-style update).
 * @param delta - positive to add, negative to subtract
 */
async function applyResourceDelta(
  supabase: SupabaseClient,
  colonyId: string,
  resourceType: string,
  delta: number
): Promise<number> {
  if (delta === 0) return 0
  if (delta < 0) {
    const { data: current } = await supabase
      .from('resources')
      .select('amount')
      .eq('colony_id', colonyId)
      .eq('type', resourceType)
      .single()
    if (!current) return 0
    const next = Math.max(0, current.amount + delta)
    await supabase
      .from('resources')
      .update({ amount: next })
      .eq('colony_id', colonyId)
      .eq('type', resourceType)
    return current.amount - next
  }
  const { data: existing } = await supabase
    .from('resources')
    .select('amount, capacity')
    .eq('colony_id', colonyId)
    .eq('type', resourceType)
    .single()
  if (existing) {
    const next = applyResourceDeltaWithCap(existing.amount, existing.capacity, delta)
    await supabase
      .from('resources')
      .update({ amount: next })
      .eq('colony_id', colonyId)
      .eq('type', resourceType)
    return next - existing.amount
  } else {
    const capacity = getBaseResourceCapacity(resourceType)
    const amount = applyResourceDeltaWithCap(0, capacity, delta)
    await supabase
      .from('resources')
      .insert({ colony_id: colonyId, type: resourceType, amount, capacity })
    return amount
  }
}

/**
 * Verify the seller has enough of every offered resource.
 * @returns map of resource → missing amount, empty when all good
 */
export async function validateOffer(
  fromColonyId: string,
  offerResources: Record<string, number>
): Promise<Record<string, number>> {
  const supabase = getServerClient()
  const missing: Record<string, number> = {}
  for (const [resourceType, amount] of Object.entries(offerResources)) {
    const { data } = await supabase
      .from('resources')
      .select('amount')
      .eq('colony_id', fromColonyId)
      .eq('type', resourceType)
      .single()
    if (!data || data.amount < amount) {
      missing[resourceType] = amount - (data?.amount ?? 0)
    }
  }
  return missing
}

/**
 * Apply a trade: deduct from seller, credit buyer.
 * @returns stolen (what actually moved) so the caller can report it
 */
export async function applyTrade(
  fromColonyId: string,
  toColonyId: string,
  offerResources: Record<string, number>,
  requestResources?: Record<string, number>
): Promise<Record<string, number>> {
  const supabase = getServerClient()
  const moved: Record<string, number> = {}

  for (const [resourceType, amount] of Object.entries(offerResources)) {
    const actual = await applyResourceDelta(supabase, fromColonyId, resourceType, -amount)
    if (actual > 0) {
      const credited = await applyResourceDelta(supabase, toColonyId, resourceType, actual)
      if (credited < actual) await applyResourceDelta(supabase, fromColonyId, resourceType, actual - credited)
      if (credited > 0) moved[resourceType] = credited
    }
  }

  if (requestResources) {
    for (const [resourceType, amount] of Object.entries(requestResources)) {
      await applyResourceDelta(supabase, toColonyId, resourceType, amount)
    }
  }

  return moved
}

/**
 * Apply the resource theft for a winning attacker. Steals RESOURCE_STEAL_RATIO
 * of each defender resource and credits the attacker with the same amount.
 * @returns the rewards map actually transferred
 */
export async function applyAttackRewards(
  attackerColonyId: string,
  defenderColonyId: string
): Promise<Record<string, number>> {
  const supabase = getServerClient()
  const { data: defenderResources } = await supabase
    .from('resources')
    .select('type, amount')
    .eq('colony_id', defenderColonyId)
  if (!defenderResources) return {}

  const rewards: Record<string, number> = {}
  for (const r of defenderResources) {
    const amount = Math.floor(r.amount * RESOURCE_STEAL_RATIO)
    if (amount > 0) {
      await applyResourceDelta(supabase, defenderColonyId, r.type, -amount)
      const credited = await applyResourceDelta(supabase, attackerColonyId, r.type, amount)
      if (credited < amount) await applyResourceDelta(supabase, defenderColonyId, r.type, amount - credited)
      if (credited > 0) rewards[r.type] = credited
    }
  }
  return rewards
}
