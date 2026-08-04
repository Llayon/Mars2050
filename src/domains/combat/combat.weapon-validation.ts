import type { UnitBaseStats } from './combat.types'
import type { AbilityEffect } from './combat.ability.types'

export const AREA_GEOMETRIES = ['aoe', 'line', 'cone', 'beam', 'barrage', 'chain', 'sweep'] as const
export type AreaGeometry = typeof AREA_GEOMETRIES[number]

export function getAreaGeometries(stats: UnitBaseStats): AreaGeometry[] {
  const geometries = new Set<AreaGeometry>()
  if (stats.attackType === 'aoe' && (stats.aoeRadius ?? 0) > 0) geometries.add('aoe')
  if (stats.linePierce) geometries.add('line')
  if (stats.coneAttack) geometries.add('cone')
  if (stats.beamAttack) geometries.add('beam')
  if (stats.barrageAttack) geometries.add('barrage')
  if (stats.chainAttack) geometries.add('chain')
  if (stats.sweepAttack) geometries.add('sweep')
  for (const ability of stats.abilities ?? []) {
    for (const group of ability.effects) {
      for (const effect of group.effects) {
        const geometry = getAuthoredAreaGeometry(effect)
        if (geometry) geometries.add(geometry)
      }
    }
  }
  return AREA_GEOMETRIES.filter(geometry => geometries.has(geometry))
}

function getAuthoredAreaGeometry(effect: AbilityEffect): AreaGeometry | undefined {
  switch (effect.kind) {
    case 'line_pierce': return 'line'
    case 'cone_attack': return 'cone'
    case 'beam_attack': return 'beam'
    case 'barrage_attack': return 'barrage'
    case 'chain_attack': return 'chain'
    default: return undefined
  }
}

export function assertValidWeaponLoadout(unitType: string, stats: UnitBaseStats): void {
  const geometries = getAreaGeometries(stats)
  if (geometries.length <= 1) return
  throw new Error(`Invalid weapon loadout for ${unitType}: multiple area geometries (${geometries.join(', ')})`)
}
