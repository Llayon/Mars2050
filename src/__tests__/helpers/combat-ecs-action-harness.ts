import type { BattleAction } from '@/domains/combat/combat.actions'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { prepareRuntimePrimitives } from '@/domains/combat/combat.runtime-primitives'
import type { SimHazard, SimUnit } from '@/domains/combat/combat.sim.types'
import type { UnitTypeKey } from '@/domains/combat/combat.types'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { runActionSystem, syncEcsTargetRefs } from '@/domains/combat/ecs/systems'
import type { PRNG } from '@/domains/combat/combat.utils'

const PRIMITIVE_FIELDS = [
  'periodicAbilities', 'triggerEffects', 'controlBeam', 'transformMode',
  'transformState', 'fieldEffect', 'formationModifiers', 'rankScaling',
  'conditionalRange', 'flatDamageBlock', 'shieldHitBlock',
  'shieldHitBlockCharges', 'statGrowth', 'attackCharge', 'reassemblyConfig',
  'targetPriorityProfile', 'conditionalAttackMode', 'sweepAttack',
  'linePierce', 'coneAttack', 'beamAttack', 'barrageAttack', 'chainAttack',
  'splitFire', 'sideWeapon', 'stealthWhileMoving',
] as const satisfies readonly (keyof SimUnit)[]

export function actionSystem(
  unit: SimUnit,
  target: SimUnit,
  units: SimUnit[],
  hazards: SimHazard[],
  actions: BattleAction[],
  rng: PRNG,
  tick = 0,
): boolean {
  const world = new CombatWorld(units.map(hydrateRuntimePrimitives))
  world.queueHazardCreation(...structuredClone(hazards))
  world.flushStructuralCommands()
  syncEcsTargetRefs(world)
  const spatial = new EntitySpatialIndex()
  spatial.rebuild(world)
  world.resources.set('entitySpatial', spatial)

  const actorId = world.getEntityId(unit.id)
  const targetId = world.getEntityId(target.id)
  if (actorId === undefined || targetId === undefined) return false
  if (!canActOnTarget(world, actorId, targetId)) return false
  const result = runActionSystem(world, actorId, targetId, actions, { rng, tick })
  world.flushStructuralCommands()
  exportState(world, units, hazards)
  return result.acted
}

function hydrateRuntimePrimitives(unit: SimUnit): SimUnit {
  const hydrated = structuredClone(unit)
  const config = UNIT_TYPES[unit.type as UnitTypeKey]
  if (!config) return hydrated
  const prepared = structuredClone(unit)
  prepareRuntimePrimitives(prepared, config.baseStats)
  for (const field of PRIMITIVE_FIELDS) {
    if (hydrated[field] === undefined && prepared[field] !== undefined) {
      Object.assign(hydrated, { [field]: structuredClone(prepared[field]) })
    }
  }
  return hydrated
}

function canActOnTarget(world: CombatWorld, actorId: number, targetId: number): boolean {
  const actor = world.stores.identity.require(actorId)
  const target = world.stores.identity.require(targetId)
  if (actor.team !== target.team) return true
  if (world.stores.weapon.require(actorId).attackType === 'heal') return true
  return world.stores.statusControl.require(actorId).statusEffects.some(effect =>
    effect.type === 'hacked' &&
    effect.duration > 0 &&
    (effect.controlMode === 'redirect' || effect.controlMode === 'confuse'),
  )
}

function exportState(world: CombatWorld, units: SimUnit[], hazards: SimHazard[]): void {
  const snapshots = world.snapshot()
  const byId = new Map(snapshots.map(snapshot => [snapshot.id, snapshot]))
  for (const unit of units) {
    const snapshot = byId.get(unit.id)
    if (snapshot) Object.assign(unit, snapshot)
  }
  const knownIds = new Set(units.map(unit => unit.id))
  units.push(...snapshots.filter(snapshot => !knownIds.has(snapshot.id)))

  const hazardSnapshots = world.query(['hazard'], true)
    .flatMap(entityId => {
      const hazard = world.getHazard(entityId)
      return hazard ? [structuredClone(hazard)] : []
    })
  hazards.splice(0, hazards.length, ...hazardSnapshots)
}
