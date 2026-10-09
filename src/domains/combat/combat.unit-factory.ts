import {
  createRuntimeUnitFromConfig as coreCreateRuntimeUnitFromConfig,
  cloneRuntimeUnit,
  type RuntimeUnitFactoryInput,
} from '@mars2050/combat-core'
import { MARS_CATALOG } from './combat.catalog'
import type { SimUnit } from './combat.types'

export type { RuntimeUnitFactoryInput }
export { cloneRuntimeUnit }

/**
 * Creates a runtime unit from config, defaulting to Mars default catalog when none is provided.
 *
 * @param input The factory input spec.
 * @returns Compiled SimUnit or null.
 */
export function createRuntimeUnitFromConfig(input: RuntimeUnitFactoryInput): SimUnit | null {
  return coreCreateRuntimeUnitFromConfig({
    ...input,
    catalog: input.catalog ?? MARS_CATALOG,
  })
}
