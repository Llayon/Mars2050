import type { BattleAction } from './combat.actions'
import type { BattleOutcome } from './combat.outcome'
import type { SimHazard, SimUnit } from './combat.sim.types'
import type { FlowFieldMap } from './combat.pathfinding'
import type { SpatialHash } from './spatial-hash'
import type { Obstacle, Team } from './combat.sim.types'
import type { UnitRow } from './combat.types'
import type { PRNG } from './combat.utils'
import type { GlobalUpgradeConfig } from './combat.upgrades'

export interface RuntimeMovementContext {
  dt: number
  rng: PRNG
  flowField: FlowFieldMap
  obstacles: Obstacle[]
  spatialHash: SpatialHash
}

export interface RuntimeActionContext {
  rng: PRNG
  tick: number
  spatialHash: SpatialHash
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
  beginTargetingPhase(spatialHash: SpatialHash): void
  selectTarget(unit: SimUnit): SimUnit | null
  reserveMeleeSlot(unit: SimUnit, target: SimUnit): boolean
  processSpawner(unit: SimUnit, target: SimUnit, actions: BattleAction[], context: RuntimeActionContext): void
  actUnit(unit: SimUnit, target: SimUnit, actions: BattleAction[], context: RuntimeActionContext): RuntimeActionResult
  moveUnit(unit: SimUnit, target: SimUnit, actions: BattleAction[], context: RuntimeMovementContext): void
  completeActorTurn(unit: SimUnit, actions: readonly BattleAction[], actionStart: number, actorSynchronized?: boolean): void
  insertSpatialUnit(unit: SimUnit): void
  snapshotUnits(): SimUnit[]
  getSurvivors(): SimUnit[]
  getTurnOrder(): SimUnit[]
  tickModifiers(unit: SimUnit, dt: number, actions: BattleAction[], rng: PRNG): void
  runReassemblyPhase(actions: BattleAction[]): void
  runGlobalEffectPhase(
    tick: number,
    activeGlobals: { team: Team, upg: GlobalUpgradeConfig }[],
    actions: BattleAction[],
    rng: PRNG,
  ): void
  runSupportAuraPhase(
    tick: number,
    actions: BattleAction[],
    spatialHash: SpatialHash,
  ): void
  runGrowthAndChargePhase(tick: number, actions: BattleAction[]): void
  runBurrowRegenerationPhase(actions: BattleAction[]): void
  runTransformModePhase(tick: number, actions: BattleAction[]): void
  runFieldEffectPhase(tick: number, actions: BattleAction[]): void
  runFormationBonusPhase(tick: number, actions: BattleAction[]): void
  runControlBeamPhase(actions: BattleAction[]): void
  runPeriodicAbilityPhase(tick: number, actions: BattleAction[], rng: PRNG): void
  runStatusPhase(actions: BattleAction[], rng: PRNG): void
  runHazardPhase(actions: BattleAction[], spatialHash: SpatialHash, rng: PRNG): void
  runPostHazardPhase(tick: number, actions: BattleAction[], rng: PRNG): void
  runDepenetration(actions: BattleAction[]): void
  getTerminalOutcome(): BattleOutcome | null
}
