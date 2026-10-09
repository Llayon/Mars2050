import {
  createRuntimeUnitFromConfig as coreCreateRuntimeUnitFromConfig,
  cloneRuntimeUnit,
  type RuntimeUnitFactoryInput,
} from '@mars2050/combat-core/combat.unit-factory'
import type { SimUnit } from './combat.sim.types'
import { MARS_CATALOG } from './combat.catalog'

/**
 * Creates a runtime unit snapshot from authored configuration, defaulting to Mars unit catalog.
 */
export function createRuntimeUnitFromConfig(input: RuntimeUnitFactoryInput): SimUnit | null {
  return coreCreateRuntimeUnitFromConfig({
    ...input,
    catalog: input.catalog ?? MARS_CATALOG,
  })
}

export { cloneRuntimeUnit }
export type { RuntimeUnitFactoryInput }

