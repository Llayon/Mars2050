import type { SimUnit, UnitRow } from '@/domains/combat/combat.types'

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
