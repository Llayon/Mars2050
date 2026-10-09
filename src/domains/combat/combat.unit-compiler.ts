import {
  compileUnit as coreCompileUnit,
  compileUnitSnapshot as coreCompileUnitSnapshot,
} from '@mars2050/combat-core/combat.unit-compiler'
import type { UnitBuildSpec } from '@mars2050/combat-core/combat.unit-build.types'
import { MARS_CATALOG } from './combat.catalog'

export * from '@mars2050/combat-core/combat.unit-compiler'

/**
 * Compiles a unit entity bundle for Mars, defaulting to Mars catalog.
 *
 * @param spec Unit build specification.
 * @returns UnitEntityBundle or null.
 */
export function compileUnit(spec: UnitBuildSpec) {
  return coreCompileUnit({
    ...spec,
    catalog: spec.catalog ?? MARS_CATALOG,
  })
}

/**
 * Compiles a unit snapshot for Mars, defaulting to Mars catalog.
 *
 * @param spec Unit build specification.
 * @returns SimUnit or null.
 */
export function compileUnitSnapshot(spec: UnitBuildSpec) {
  return coreCompileUnitSnapshot({
    ...spec,
    catalog: spec.catalog ?? MARS_CATALOG,
  })
}

