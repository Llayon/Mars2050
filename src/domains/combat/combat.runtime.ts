import type { BattleAction } from './combat.actions'
import type { BattleOutcome } from './combat.outcome'
import type { SimHazard, SimUnit } from './combat.sim.types'
import type { FlowFieldMap } from './combat.pathfinding'
import type { Obstacle, Team } from './combat.sim.types'
import type { UnitRow } from './combat.types'
import type { PRNG } from './combat.utils'
import type { GlobalUpgradeConfig } from './combat.upgrades'
import type { EntityId } from './ecs/entity'

export interface RuntimeMovementContext {
  dt: number
  rng: PRNG
  flowField: FlowFieldMap
  obstacles: Obstacle[]
}

export interface RuntimeActionContext {
  rng: PRNG
  tick: number
}

export interface RuntimeActionResult {
  acted: boolean
  actorSynchronized: boolean
}

export interface CombatRuntime {
  readonly units: SimUnit[]
  readonly hazards: SimHazard[]
  addSquad(row: UnitRow, team: Team, rng: PRNG): void
  flushStructuralCommands(): void
  beginTargetingPhase(): void
  selectTarget(entityId: EntityId): EntityId | null
  reserveMeleeSlot(entityId: EntityId, targetId: EntityId): boolean
  processSpawner(entityId: EntityId, targetId: EntityId, actions: BattleAction[], context: RuntimeActionContext): void
  actUnit(entityId: EntityId, targetId: EntityId, actions: BattleAction[], context: RuntimeActionContext): RuntimeActionResult
  moveUnit(entityId: EntityId, targetId: EntityId, actions: BattleAction[], context: RuntimeMovementContext): void
  insertSpatialUnit(entityId: EntityId): void
  isDead(entityId: EntityId): boolean
  canActOnTarget(entityId: EntityId, targetId: EntityId): boolean
  snapshotUnits(): SimUnit[]
  getSurvivors(): SimUnit[]
  getTurnOrder(): EntityId[]
  tickModifiers(entityId: EntityId, dt: number, actions: BattleAction[], rng: PRNG): void
  runReassemblyPhase(actions: BattleAction[]): void
  runGlobalEffectPhase(
    tick: number,
    activeGlobals: { team: Team, upg: GlobalUpgradeConfig }[],
    actions: BattleAction[],
    rng: PRNG,
  ): void
  runSupportAuraPhase(tick: number, actions: BattleAction[]): void
  runGrowthAndChargePhase(tick: number, actions: BattleAction[]): void
  runBurrowRegenerationPhase(actions: BattleAction[]): void
  runTransformModePhase(tick: number, actions: BattleAction[]): void
  runFieldEffectPhase(tick: number, actions: BattleAction[]): void
  runFormationBonusPhase(tick: number, actions: BattleAction[]): void
  runControlBeamPhase(actions: BattleAction[]): void
  runPeriodicAbilityPhase(tick: number, actions: BattleAction[], rng: PRNG): void
  runStatusPhase(actions: BattleAction[], rng: PRNG): void
  runHazardPhase(actions: BattleAction[], rng: PRNG): void
  runPostHazardPhase(tick: number, actions: BattleAction[], rng: PRNG): void
  runDepenetration(actions: BattleAction[]): void
  getTerminalOutcome(): BattleOutcome | null
}
