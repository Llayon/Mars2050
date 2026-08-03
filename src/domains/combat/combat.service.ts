import { getServerClient } from '@/domains/resource/resource.server'
import { applyResourceDeltaWithCap } from '@/domains/resource/resource.storage'
import { UNIT_TYPES } from './combat.config'
import type { UnitTypeKey } from './combat.types'

/**
 * Hires a new unit for the given colony.
 * Deducts resources and creates a unit record.
 */
export async function hireUnit(colonyId: string, unitType: UnitTypeKey) {
  const supabase = getServerClient()
  const config = UNIT_TYPES[unitType]

  if (!config || config.recruitable === false) {
    return { success: false, error: 'Invalid unit type' }
  }

  // Check and deduct resources
  for (const [resType, amount] of Object.entries(config.hireCost)) {
    const { data: resource } = await supabase
      .from('resources')
      .select('amount')
      .eq('colony_id', colonyId)
      .eq('type', resType)
      .single()

    if (!resource || resource.amount < amount) {
      return { success: false, error: `Not enough ${resType}` }
    }
  }

  for (const [resType, amount] of Object.entries(config.hireCost)) {
    const { data: current } = await supabase
      .from('resources')
      .select('amount')
      .eq('colony_id', colonyId)
      .eq('type', resType)
      .single()

    if (current) {
      await supabase
        .from('resources')
        .update({ amount: Math.max(0, current.amount - amount) })
        .eq('colony_id', colonyId)
        .eq('type', resType)
    }
  }

  // Create unit
  const { data: newUnit, error } = await supabase
    .from('units')
    .insert({
      colony_id: colonyId,
      unit_type: unitType,
      hp_current: config.baseStats.hp,
      tier: 1,
      upgrade_path: []
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data: newUnit }
}

/**
 * Dismisses a unit, refunding 50% of the base cost.
 */
export async function dismissUnit(colonyId: string, unitId: string) {
  const supabase = getServerClient()

  const { data: unit } = await supabase
    .from('units')
    .select('*')
    .eq('id', unitId)
    .eq('colony_id', colonyId)
    .single()

  if (!unit) return { success: false, error: 'Unit not found' }

  const config = UNIT_TYPES[unit.unit_type as UnitTypeKey]
  
  // Refund 50%
  for (const [resType, amount] of Object.entries(config.hireCost)) {
    const refund = Math.floor(amount * 0.5)
    if (refund > 0) {
      const { data: current } = await supabase
        .from('resources')
        .select('amount, capacity')
        .eq('colony_id', colonyId)
        .eq('type', resType)
        .single()

      if (current) {
        await supabase
          .from('resources')
          .update({ amount: applyResourceDeltaWithCap(current.amount, current.capacity, refund) })
          .eq('colony_id', colonyId)
          .eq('type', resType)
      }
    }
  }

  const { error } = await supabase.from('units').delete().eq('id', unitId)
  if (error) return { success: false, error: error.message }

  return { success: true, message: 'Юнит уволен, ресурсы частично возвращены' }
}

/**
 * Sets the defensive garrison positions for a colony.
 */
export async function setGarrison(colonyId: string, unitsPlacement: { unitId: string, x: number, y: number }[]) {
  const supabase = getServerClient()

  // Validate ownership and update coordinates
  // Note: we update them sequentially for simplicity. In production with many units, an RPC or bulk update is better.
  for (const placement of unitsPlacement) {
    await supabase
      .from('units')
      .update({ grid_x: placement.x, grid_y: placement.y })
      .eq('id', placement.unitId)
      .eq('colony_id', colonyId)
  }

  return { success: true, message: 'Гарнизон расставлен!' }
}
