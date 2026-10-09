import { getRuntimePrimitiveStats as coreGetRuntimePrimitiveStats } from '@mars2050/combat-core'
import type { UnitBaseStats } from './combat.types'
import type { UpgradeConfig } from './combat.upgrades'
import { UPGRADES, buildMarsUpgrades } from './combat.upgrades'

/**
 * Resolves runtime primitive stats from upgrade modifiers with Mars domain tile-to-world scaling.
 * Uses prepared Mars upgrades to ensure uniform single-pass tile-to-pixel conversions without heuristics.
 *
 * @param baseStats The base unit stats.
 * @param upgradePath The list or set of upgrades applied.
 * @param upgradesCatalog Optional upgrades catalog override.
 * @returns Resolved primitive stats with prepared world coordinates.
 */
export function getRuntimePrimitiveStats(
  baseStats: UnitBaseStats,
  upgradePath: unknown,
  upgradesCatalog?: Record<string, UpgradeConfig>,
  preparedStats?: import('@mars2050/combat-core/contracts').PreparedStats,
): UnitBaseStats {
  const preparedCatalog = buildMarsUpgrades(upgradesCatalog ?? UPGRADES)
  return coreGetRuntimePrimitiveStats(
    baseStats as unknown as Parameters<typeof coreGetRuntimePrimitiveStats>[0],
    upgradePath,
    preparedCatalog as unknown as Parameters<typeof coreGetRuntimePrimitiveStats>[2],
    preparedStats,
  ) as unknown as UnitBaseStats
}
