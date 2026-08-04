import type {
  CombatTag,
  MineOnActionConfig,
  OnKillConfig,
  PercentHpDamageConfig,
  RampDamageConfig,
  ChargeDamageConfig,
} from './combat.primitives'
import type { Team } from './combat.sim.types'
import type { TargetingProfileKey, UnitTypeKey } from './combat.types'

export type SpawnInheritance =
  | 'base'
  | 'owner_rank'
  | 'owner_loadout'
  | 'selected_upgrades'

export interface RuntimeUnitFactoryInput {
  id: string
  team: Team
  type: string
  x: number
  y: number
  currentAngle: number
  summonOwnerId?: string
  summonSourceId?: string
  hp?: number
  attack?: number
  isTemporary?: boolean
  temporaryDuration?: number
}

export interface UnitBuildSpec {
  definitionId: UnitTypeKey
  identity: {
    id: string
    team: Team
    squadId?: string
    summonOwnerId?: string
    summonSourceId?: string
  }
  loadout: {
    rank: number
    upgradeIds: string[]
  }
  placement: {
    x: number
    y: number
    angle: number
    offsetX?: number
    offsetY?: number
  }
  spawn?: {
    inheritance: SpawnInheritance
    selectedUpgradeIds?: string[]
  }
  overrides?: {
    currentHp?: number
    maxHp?: number
    hpPercent?: number
    attack?: number
    isTemporary?: boolean
    temporaryDuration?: number
  }
}

export interface UnitRuntimeRules {
  baseCombatTags: CombatTag[]
  healTargetTags?: CombatTag[]
  targetingProfile: TargetingProfileKey
  minimumRange: number
  rampDamage?: RampDamageConfig
  chargeDamage?: ChargeDamageConfig
  percentHpDamage?: PercentHpDamageConfig & { maxBonus: number }
  mineOnAction?: MineOnActionConfig
  onKill?: OnKillConfig
  projectileInterceptable: boolean
  spawnOverrides?: {
    hp?: number
    attack?: number
    isTemporary?: boolean
    duration?: number
  }
}
