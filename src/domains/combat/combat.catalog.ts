import { mapDefinitionToUnitTypeConfig, type CombatCatalog } from '@mars2050/combat-core'
import type { UnitTypeConfig } from './combat.types'
import { UNIT_TYPES } from './combat.config'
import { buildMarsUnitDefinitions } from './combat.unit-definitions'
import { buildMarsUpgrades } from './combat.upgrades'
import { buildMarsPreparedStats } from './combat.prepared-stats'

function createMarsCombatCatalog(): CombatCatalog {
  const rawDefs = buildMarsUnitDefinitions(UNIT_TYPES)
  const upgrades = buildMarsUpgrades()
  const tempCatalog = { upgrades }
  const rawTypes = UNIT_TYPES as Record<string, UnitTypeConfig>
  const unitTypes: Record<string, UnitTypeConfig> = {}
  for (const [key, def] of Object.entries(rawDefs)) {
    const config = mapDefinitionToUnitTypeConfig(def)
    unitTypes[key] = {
      ...config,
      hireCost: rawTypes[key]?.hireCost ?? {},
      preparedStats: buildMarsPreparedStats(key, 1, [], tempCatalog, rawDefs),
    } as unknown as UnitTypeConfig
  }
  return {
    unitTypes: unitTypes as unknown as CombatCatalog['unitTypes'],
    upgrades: upgrades as unknown as CombatCatalog['upgrades'],
  }
}

export const MARS_CATALOG: CombatCatalog = createMarsCombatCatalog()

/**
 * Returns the default Mars combat catalog.
 *
 * @returns Mars CombatCatalog.
 */
export function getMarsCombatCatalog(): CombatCatalog {
  return MARS_CATALOG
}
