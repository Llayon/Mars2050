import {
  createRuntimeUnitFromConfig as coreCreateRuntimeUnitFromConfig,
  cloneRuntimeUnit,
  type RuntimeUnitFactoryInput,
} from '../../../packages/combat-core/src/combat.unit-factory.js'
import { MARS_CATALOG } from '@/domains/combat/combat.catalog'
import type { SimUnit } from '../../../packages/combat-core/src/combat.sim.types.js'

export type { RuntimeUnitFactoryInput }
export { cloneRuntimeUnit }

/**
 * Creates a runtime unit from config for diagnostic tests, defaulting to Mars default catalog.
 */
export function createRuntimeUnitFromConfig(input: RuntimeUnitFactoryInput): SimUnit | null {
  return coreCreateRuntimeUnitFromConfig({
    ...input,
    catalog: input.catalog ?? MARS_CATALOG,
  })
}
