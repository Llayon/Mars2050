import type { UnitBaseStats } from './combat.types'
import type { AbilityDefinition } from './combat.ability.types'

export function createLegacyAbilityDefinitions(unitType: string, stats: UnitBaseStats): AbilityDefinition[] {
  const groups: AbilityDefinition['effects'] = []
  if (stats.statusOnHit?.length) {
    for (const status of stats.statusOnHit) {
      groups.push({
        selector: { kind: 'primary_target' },
        effects: [{ kind: 'apply_status', status: status.type, duration: status.duration, value: status.value }],
      })
    }
  }
  const programs: AbilityDefinition[] = []
  if (groups.length > 0) programs.push({ id: `${unitType}:legacy:on_hit`, trigger: { kind: 'hit' }, effects: groups })
  const geometries: AbilityDefinition['effects'] = []
  if (stats.coneAttack || stats.beamAttack || stats.linePierce) geometries.push({ selector: { kind: 'primary_target' }, effects: [{ kind: 'legacy_geometry', geometry: 'directional' }] })
  if (stats.barrageAttack) geometries.push({ selector: { kind: 'primary_target' }, effects: [{ kind: 'legacy_geometry', geometry: 'barrage' }] })
  if (stats.chainAttack) geometries.push({ selector: { kind: 'primary_target' }, effects: [{ kind: 'legacy_geometry', geometry: 'chain' }] })
  if (stats.splitFire) geometries.push({ selector: { kind: 'primary_target' }, effects: [{ kind: 'legacy_geometry', geometry: 'split' }] })
  if (stats.sideWeapon) geometries.push({ selector: { kind: 'primary_target' }, effects: [{ kind: 'legacy_geometry', geometry: 'side' }] })
  if (stats.conditionalAttackMode) geometries.push({ selector: { kind: 'primary_target' }, effects: [{ kind: 'legacy_geometry', geometry: 'conditional' }] })
  if (stats.sweepAttack) geometries.push({ selector: { kind: 'primary_target' }, effects: [{ kind: 'legacy_geometry', geometry: 'sweep' }] })
  if (stats.aoeRadius) geometries.push({ selector: { kind: 'primary_target' }, effects: [{ kind: 'legacy_geometry', geometry: 'radial' }] })
  if (stats.pullOnHit || stats.knockbackOnHit) geometries.push({ selector: { kind: 'primary_target' }, effects: [{ kind: 'legacy_geometry', geometry: 'displacement' }] })
  if (geometries.length > 0) programs.push({ id: `${unitType}:legacy:geometry`, trigger: { kind: 'weapon_attack' }, effects: geometries })
  return programs
}
