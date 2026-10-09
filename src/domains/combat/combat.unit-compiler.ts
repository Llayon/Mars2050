import {
  compileUnitSnapshot as coreCompileUnitSnapshot,
  type UnitBuildSpec,
} from '@mars2050/combat-core'
import { MARS_CATALOG } from './combat.catalog'
import type { SimUnit } from './combat.types'
import { captureUnitEntityBundle } from '@/domains/combat/ecs/unit-entity-bundle'

export type { UnitBuildSpec }

/**
 * Compiles a unit snapshot, defaulting to Mars default catalog when none is provided.
 *
 * @param spec The unit build spec.
 * @returns Compiled SimUnit or null.
 */
export function compileUnitSnapshot(spec: UnitBuildSpec): SimUnit | null {
  return coreCompileUnitSnapshot({
    ...spec,
    catalog: spec.catalog ?? MARS_CATALOG,
  })
}

/**
 * Compiles a unit entity bundle, defaulting to Mars default catalog when none is provided.
 *
 * @param spec The unit build spec.
 * @returns Unit entity bundle or null.
 */
export function compileUnit(spec: UnitBuildSpec) {
  const snapshot = compileUnitSnapshot(spec)
  return snapshot ? captureUnitEntityBundle(snapshot) : null
}
