import type { SimUnit } from '../combat.sim.types'
import type { CombatComponentStores, UnitCapabilityName } from './combat-components'
import type { EntityId } from './entity'

export const UNIT_CAPABILITY_NAMES = [
  'supportAuraCapability',
  'periodicAbilityCapability',
  'fieldEffectCapability',
  'formationBonusCapability',
  'controlBeamCapability',
  'transformModeCapability',
  'growthChargeCapability',
  'burrowRegenerationCapability',
] as const satisfies readonly UnitCapabilityName[]

export function installUnitCapabilities(
  stores: CombatComponentStores,
  entityId: EntityId,
  unit: SimUnit,
): void {
  for (const capability of UNIT_CAPABILITY_NAMES) {
    if (hasCapability(unit, capability)) stores[capability].set(entityId, { present: true })
  }
}

export function installCapabilityNames(
  stores: CombatComponentStores,
  entityId: EntityId,
  capabilities: readonly UnitCapabilityName[],
): void {
  for (const capability of capabilities) stores[capability].set(entityId, { present: true })
}

export function captureCapabilityNames(
  stores: CombatComponentStores,
  entityId: EntityId,
): UnitCapabilityName[] {
  return UNIT_CAPABILITY_NAMES.filter(capability => stores[capability].has(entityId))
}

export function setUnitCapabilityPresence(
  stores: CombatComponentStores,
  entityId: EntityId,
  capability: UnitCapabilityName,
  present: boolean,
): boolean {
  const store = stores[capability]
  if (store.has(entityId) === present) return false
  if (present) store.set(entityId, { present: true })
  else {
    store.delete(entityId)
    store.compactIfNeeded()
  }
  return true
}

function hasCapability(unit: SimUnit, capability: UnitCapabilityName): boolean {
  switch (capability) {
    case 'supportAuraCapability': return (unit.supportAuras?.length ?? 0) > 0
    case 'periodicAbilityCapability': return (unit.periodicAbilities?.length ?? 0) > 0
    case 'fieldEffectCapability': return (unit.fieldEffect?.length ?? 0) > 0
    case 'formationBonusCapability': return Boolean(unit.formationModifiers?.adjacencyBonus)
    case 'controlBeamCapability': return unit.controlBeam !== undefined
    case 'transformModeCapability': return (unit.transformMode?.length ?? 0) > 0
    case 'growthChargeCapability': return unit.statGrowth !== undefined || unit.attackCharge !== undefined
    case 'burrowRegenerationCapability': return (unit.burrowConfig?.regenPercentPerTick ?? 0) > 0
  }
}
