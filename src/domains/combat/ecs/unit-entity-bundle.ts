import type { SimUnit } from '../combat.sim.types'
import type { UnitComponentDataMap } from '../combat.unit-components'
import { COMPONENT_FIELDS, type UnitComponentName, type UnitCapabilityName } from './combat-components'
import { captureUnitRelations, type PendingUnitRelations } from './unit-relation-codec'
import { getUnitCapabilityNames } from './unit-capabilities'
import { getStatusStackIdentity } from '../combat.status-core'
import { DEFAULT_TARGETING_PROFILE } from '../combat.targeting.config'
import type { UnitRuntimeRules } from '../combat.unit-build.types'

export interface UnitEntityBundle {
  externalId: string
  components: UnitComponentDataMap
  capabilities: UnitCapabilityName[]
  relations: PendingUnitRelations
  statusSources: Record<string, string>
  targetMarkSource?: string
  controlProgressSource?: string
  runtimeRules: UnitRuntimeRules
}

export function captureUnitEntityBundle(unit: SimUnit): UnitEntityBundle {
  const entries = (Object.keys(COMPONENT_FIELDS) as UnitComponentName[]).map(name => {
    const component: Record<string, unknown> = {}
    for (const field of COMPONENT_FIELDS[name]) {
      if (field in unit) component[field] = unit[field]
    }
    return [name, structuredClone(component)] as const
  })
  return {
    externalId: unit.id,
    components: Object.fromEntries(entries) as unknown as UnitComponentDataMap,
    capabilities: getUnitCapabilityNames(unit),
    relations: captureUnitRelations(unit),
    statusSources: Object.fromEntries(unit.statusEffects.flatMap(effect =>
      effect.sourceUnitId
        ? [[getStatusStackIdentity(effect), effect.sourceUnitId]]
        : [],
    )),
    targetMarkSource: unit.targetMark?.sourceUnitId,
    controlProgressSource: unit.controlProgress?.sourceUnitId,
    runtimeRules: structuredClone(unit.runtimeRules ?? {
      baseCombatTags: [],
      targetingProfile: DEFAULT_TARGETING_PROFILE,
      minimumRange: 0,
      projectileInterceptable: false,
    }),
  }
}
