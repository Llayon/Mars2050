import type { ComponentName } from './combat-components'

const COMPONENT_INDEX: Record<ComponentName, number> = {
  entityMeta: 0,
  identity: 1,
  transform: 2,
  vitality: 3,
  combat: 4,
  weapon: 5,
  targeting: 6,
  movement: 7,
  statusControl: 8,
  defense: 9,
  support: 10,
  lifecycle: 11,
  entityTargets: 12,
  hazard: 13,
  supportAuraCapability: 14,
  periodicAbilityCapability: 15,
  fieldEffectCapability: 16,
  formationBonusCapability: 17,
  controlBeamCapability: 18,
  transformModeCapability: 19,
  growthChargeCapability: 20,
  burrowRegenerationCapability: 21,
  triggerCapability: 22,
  reassemblyCapability: 23,
  periodicSpawnerCapability: 24,
  activeStatusCapability: 25,
  activeControlProgressCapability: 26,
  entitySources: 27,
  runtimeRules: 28,
}

export interface QuerySpec {
  readonly components: readonly ComponentName[]
  readonly mask: number
}

export function defineQuery(components: readonly ComponentName[]): QuerySpec {
  return Object.freeze({
    components: Object.freeze([...components]),
    mask: getQueryMask(components),
  })
}

export function getQueryMask(components: readonly ComponentName[]): number {
  let mask = 0
  for (const component of components) mask |= 1 << COMPONENT_INDEX[component]
  return mask
}

export function isQuerySpec(value: readonly ComponentName[] | QuerySpec): value is QuerySpec {
  return 'mask' in value
}
