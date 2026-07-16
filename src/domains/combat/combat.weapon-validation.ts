import type { UnitBaseStats } from './combat.types'

export const AREA_GEOMETRIES = ['aoe', 'line', 'cone', 'beam', 'barrage', 'chain', 'sweep'] as const
export type AreaGeometry = typeof AREA_GEOMETRIES[number]

export function getAreaGeometries(stats: UnitBaseStats): AreaGeometry[] {
  const geometries: AreaGeometry[] = []
  if (stats.attackType === 'aoe' && (stats.aoeRadius ?? 0) > 0) geometries.push('aoe')
  if (stats.linePierce) geometries.push('line')
  if (stats.coneAttack) geometries.push('cone')
  if (stats.beamAttack) geometries.push('beam')
  if (stats.barrageAttack) geometries.push('barrage')
  if (stats.chainAttack) geometries.push('chain')
  if (stats.sweepAttack) geometries.push('sweep')
  return geometries
}

export function assertValidWeaponLoadout(unitType: string, stats: UnitBaseStats): void {
  const geometries = getAreaGeometries(stats)
  if (geometries.length <= 1) return
  throw new Error(`Invalid weapon loadout for ${unitType}: multiple area geometries (${geometries.join(', ')})`)
}

