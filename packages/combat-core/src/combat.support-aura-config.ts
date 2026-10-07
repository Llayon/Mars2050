import type { SupportAura } from './combat.sim.types.js'
import { getDefaultCombatCatalog, type UpgradeConfig } from './combat.catalog.types.js'

export function getUnitSupportAuras(
  baseAuras: SupportAura[] | undefined,
  upgradePath: unknown,
  upgradesCatalog?: Record<string, UpgradeConfig>,
): SupportAura[] | undefined {
  const catalog = upgradesCatalog ?? (getDefaultCombatCatalog()?.upgrades as Record<string, UpgradeConfig>) ?? {}
  const auras = baseAuras?.map(aura => ({ ...aura })) ?? []
  if (Array.isArray(upgradePath)) {
    for (const upgradeId of upgradePath) {
      if (typeof upgradeId !== 'string') continue
      const extraAuras = (catalog[upgradeId]?.modifiers as { supportAuras?: SupportAura[] } | undefined)?.supportAuras
      if (extraAuras && Array.isArray(extraAuras)) {
        for (const aura of extraAuras) auras.push({ ...aura })
      }
    }
  }
  return auras.length > 0 ? auras : undefined
}
