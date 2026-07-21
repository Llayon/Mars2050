import type { CombatPhaseId, CombatPhaseStage, RuntimePhaseContext } from '../combat.phase'
import { CombatInvariantError } from './combat-invariant-error'
import type { CombatWorld } from './combat-world'
import {
  getEcsBurrowRegenerationEntities,
  getEcsControlBeamEntities,
  getEcsFieldEffectEntities,
  getEcsFormationBonusEntities,
  getEcsGrowthAndChargeEntities,
  getEcsPeriodicAbilityEntities,
  getEcsSupportAuraEntities,
  getEcsTransformModeEntities,
  hasEcsGlobalEffectAtTick,
  hasEcsSupportAuraAtTick,
  processEcsHpThresholdTriggers,
  resolveEcsDeath,
  runDepenetrationSystem,
  runEcsBurrowRegenerationSystem,
  runEcsControlBeamSystem,
  runEcsFieldEffectSystem,
  runEcsFormationBonusSystem,
  runEcsGlobalEffectSystem,
  runEcsGrowthAndChargeSystem,
  runEcsPeriodicAbilitySystem,
  runEcsReassemblySystem,
  runEcsSupportAuraSystem,
  runEcsTransformModeSystem,
  runHazardSystem,
  runStatusSystem,
} from './systems'

interface EcsPhaseDefinition {
  id: CombatPhaseId
  stage: CombatPhaseStage
  run(world: CombatWorld, context: RuntimePhaseContext): void
}

const ECS_PHASES = [
  phase('reassembly', 'pre_action', (world, context) => runEcsReassemblySystem(world, context.actions)),
  phase('global_effect', 'pre_action', runGlobalEffectPhase),
  phase('support_aura', 'pre_action', runSupportAuraPhase),
  phase('growth_charge', 'pre_action', (world, context) => runEcsGrowthAndChargeSystem(world, context.tick, context.actions, getEcsGrowthAndChargeEntities(world))),
  phase('burrow_regeneration', 'pre_action', (world, context) => runEcsBurrowRegenerationSystem(world, context.actions, getEcsBurrowRegenerationEntities(world))),
  phase('transform_mode', 'pre_action', (world, context) => runEcsTransformModeSystem(world, context.tick, context.actions, getEcsTransformModeEntities(world))),
  phase('field_effect', 'pre_action', runFieldEffectPhase),
  phase('formation_bonus', 'pre_action', runFormationBonusPhase),
  phase('control_beam', 'pre_action', runControlBeamPhase),
  phase('periodic_ability', 'pre_action', runPeriodicAbilityPhase),
  phase('structural_flush', 'pre_action', world => world.flushStructuralCommands()),
  phase('status', 'pre_action', runStatusPhase),
  phase('hazard', 'post_action', runHazardPhase),
  phase('hp_threshold_trigger', 'post_action', runHpThresholdPhase),
  phase('depenetration', 'post_action', (world, context) => runDepenetrationSystem(world, context.actions)),
] as const satisfies readonly EcsPhaseDefinition[]

const PHASE_BY_ID = new Map(ECS_PHASES.map(definition => [definition.id, definition]))

export class EcsCombatPhaseScheduler {
  constructor(private readonly world: CombatWorld) {}

  runPhase(id: CombatPhaseId, context: RuntimePhaseContext): void {
    prepareResources(this.world, context)
    const definition = PHASE_BY_ID.get(id)
    if (!definition) throw new CombatInvariantError(`Unknown combat phase: ${id}`)
    definition.run(this.world, context)
  }

  runStage(stage: CombatPhaseStage, context: RuntimePhaseContext): void {
    prepareResources(this.world, context)
    for (const definition of ECS_PHASES) {
      if (definition.stage === stage) definition.run(this.world, context)
    }
  }
}

export function getEcsPhaseOrder(stage: CombatPhaseStage): CombatPhaseId[] {
  return ECS_PHASES.filter(definition => definition.stage === stage)
    .map(definition => definition.id)
}

function phase(
  id: CombatPhaseId,
  stage: CombatPhaseStage,
  run: EcsPhaseDefinition['run'],
): EcsPhaseDefinition {
  return { id, stage, run }
}

function runGlobalEffectPhase(world: CombatWorld, context: RuntimePhaseContext): void {
  const globals = context.activeGlobals ?? []
  if (!hasEcsGlobalEffectAtTick(context.tick, globals)) return
  runEcsGlobalEffectSystem(world, context.tick, globals, context.actions, requireRng(world, context, 'global_effect'))
}

function runSupportAuraPhase(world: CombatWorld, context: RuntimePhaseContext): void {
  const entityIds = getEcsSupportAuraEntities(world)
  if (!hasEcsSupportAuraAtTick(world, context.tick, entityIds)) return
  ensureSpatial(world)
  runEcsSupportAuraSystem(world, context.tick, context.actions, entityIds)
}

function runFieldEffectPhase(world: CombatWorld, context: RuntimePhaseContext): void {
  const entityIds = getEcsFieldEffectEntities(world)
  if (entityIds.length === 0) return
  world.flushStructuralCommands()
  runEcsFieldEffectSystem(world, context.tick, context.actions, entityIds)
}

function runFormationBonusPhase(world: CombatWorld, context: RuntimePhaseContext): void {
  if (context.tick % 10 !== 0) return
  const entityIds = getEcsFormationBonusEntities(world)
  if (entityIds.length === 0) return
  ensureSpatial(world)
  runEcsFormationBonusSystem(world, context.tick, context.actions, entityIds)
}

function runControlBeamPhase(world: CombatWorld, context: RuntimePhaseContext): void {
  const entityIds = getEcsControlBeamEntities(world)
  if (entityIds.length === 0) return
  ensureSpatial(world)
  runEcsControlBeamSystem(world, context.actions, entityIds)
}

function runPeriodicAbilityPhase(world: CombatWorld, context: RuntimePhaseContext): void {
  const entityIds = getEcsPeriodicAbilityEntities(world)
  if (entityIds.length === 0) return
  world.flushStructuralCommands()
  requireRng(world, context, 'periodic_ability')
  ensureSpatial(world)
  runEcsPeriodicAbilitySystem(world, context.tick, context.actions, entityIds)
  world.flushStructuralCommands()
}

function runStatusPhase(world: CombatWorld, context: RuntimePhaseContext): void {
  world.flushStructuralCommands()
  runStatusSystem(world, context.actions, (entityId, sourceUnitId, cause) => {
    resolveEnvironmentalDeath(world, entityId, sourceUnitId, context, cause)
  })
}

function runHazardPhase(world: CombatWorld, context: RuntimePhaseContext): void {
  world.flushStructuralCommands()
  ensureSpatial(world)
  runHazardSystem(world, context.actions, (entityId, sourceUnitId, cause) => {
    resolveEnvironmentalDeath(world, entityId, sourceUnitId, context, cause)
  })
}

function runHpThresholdPhase(world: CombatWorld, context: RuntimePhaseContext): void {
  const ordered = world.query(['identity', 'vitality', 'lifecycle', 'triggerCapability'])
    .sort((left, right) => world.stores.identity.require(left).id.localeCompare(world.stores.identity.require(right).id))
  for (const entityId of ordered) processEcsHpThresholdTriggers(world, entityId, context.actions)
}

function resolveEnvironmentalDeath(
  world: CombatWorld,
  entityId: number,
  sourceUnitId: string | undefined,
  context: RuntimePhaseContext,
  cause: Parameters<typeof resolveEcsDeath>[4],
): void {
  const sourceId = sourceUnitId === undefined ? undefined : world.getEntityId(sourceUnitId)
  resolveEcsDeath(world, entityId, sourceId, context.actions, cause)
  world.flushStructuralCommands()
}

function prepareResources(world: CombatWorld, context: RuntimePhaseContext): void {
  world.resources.set('actions', context.actions)
  if (context.rng) world.resources.set('rng', context.rng)
  if (context.activeGlobals) world.resources.set('globals', context.activeGlobals)
}

function requireRng(world: CombatWorld, context: RuntimePhaseContext, phaseId: CombatPhaseId) {
  const rng = context.rng ?? world.resources.get('rng')
  if (!rng) throw new CombatInvariantError(`Combat phase ${phaseId} requires seeded RNG`)
  world.resources.set('rng', rng)
  return rng
}

function ensureSpatial(world: CombatWorld): void {
  world.resources.require('entitySpatial').ensureCurrent(world)
}
