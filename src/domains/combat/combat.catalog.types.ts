import type { TargetingProfileConfig, UnitTypeConfig } from './combat.types'
import type { UpgradeConfig } from './combat.upgrades'

export interface CombatCatalog {
  readonly unitTypes: Readonly<Record<string, UnitTypeConfig>>
  readonly upgrades?: Readonly<Record<string, UpgradeConfig>>
  readonly targetingProfiles?: Readonly<Record<string, TargetingProfileConfig>>
}
