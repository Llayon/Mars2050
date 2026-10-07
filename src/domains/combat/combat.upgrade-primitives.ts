import { getRuntimePrimitiveStats as coreGetRuntimePrimitiveStats } from '@mars2050/combat-core/combat.upgrade-primitives'
import type { UnitBaseStats } from './combat.types'
import type { UpgradeConfig } from './combat.upgrades'
import { UPGRADES } from './combat.upgrades'

/**
 * Resolves runtime primitive stats from upgrade modifiers with Mars domain tile-to-world scaling.
 */
export function getRuntimePrimitiveStats(
  baseStats: UnitBaseStats,
  upgradePath: unknown,
  upgradesCatalog?: Record<string, UpgradeConfig>,
): UnitBaseStats {
  const catalog = upgradesCatalog ?? UPGRADES
  const stats = coreGetRuntimePrimitiveStats(baseStats, upgradePath, catalog)
  if (stats.sideWeapon && stats.sideWeapon.range < 20) {
    stats.sideWeapon = { ...stats.sideWeapon, range: stats.sideWeapon.range * 40 }
  }
  if (stats.splitFire && stats.splitFire.range != null && stats.splitFire.range < 20) {
    stats.splitFire = { ...stats.splitFire, range: stats.splitFire.range * 40 }
  }
  return stats
}
