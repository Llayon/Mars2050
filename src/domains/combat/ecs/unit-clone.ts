import type { UnitComponentDataMap } from '../combat.unit-components'
import type { UnitCapabilityName } from './combat-components'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'
import { captureCapabilityNames } from './unit-capabilities'

export interface UnitCloneData {
  externalId: string
  components: UnitComponentDataMap
  capabilities: UnitCapabilityName[]
}

export function captureUnitClone(
  world: CombatWorld,
  sourceId: EntityId,
  externalId: string,
  x: number,
  y: number,
): UnitCloneData {
  const components: UnitComponentDataMap = {
    identity: structuredClone(world.stores.identity.require(sourceId)),
    transform: structuredClone(world.stores.transform.require(sourceId)),
    vitality: structuredClone(world.stores.vitality.require(sourceId)),
    combat: structuredClone(world.stores.combat.require(sourceId)),
    weapon: structuredClone(world.stores.weapon.require(sourceId)),
    targeting: structuredClone(world.stores.targeting.require(sourceId)),
    movement: structuredClone(world.stores.movement.require(sourceId)),
    statusControl: structuredClone(world.stores.statusControl.require(sourceId)),
    defense: structuredClone(world.stores.defense.require(sourceId)),
    support: structuredClone(world.stores.support.require(sourceId)),
    lifecycle: structuredClone(world.stores.lifecycle.require(sourceId)),
  }

  components.identity.id = externalId
  components.identity.squadId = undefined
  Object.assign(components.transform, { x, y, velocity: { x: 0, y: 0 } })
  Object.assign(components.vitality, {
    hp: components.vitality.maxHp,
    shield: components.vitality.maxShield,
    isDead: false,
    reassemblyState: undefined,
    reassemblyTriggersUsed: 0,
  })
  components.combat.actionCooldown = 0
  components.weapon.emergeStrikePending = undefined
  Object.assign(components.targeting, {
    rampMultiplier: undefined,
    chargeDistance: 0,
    aggroLockTicks: 0,
    meleeSlotIndex: undefined,
    controlProgress: undefined,
  })
  Object.assign(components.movement, {
    isMoving: false,
    isNavigatingObstacle: false,
    lastProgressX: undefined,
    lastProgressY: undefined,
    lastTargetDistance: undefined,
    stuckTicks: 0,
    avoidanceSide: undefined,
    avoidanceTicks: 0,
    isBurrowed: false,
    movementStealthActive: false,
  })
  Object.assign(components.statusControl, {
    statusEffects: [],
    targetMark: undefined,
    hasAttacked: false,
  })
  const capabilities = captureCapabilityNames(world.stores, sourceId)
    .filter(capability => capability !== 'reassemblyCapability' || components.vitality.reassemblyConfig !== undefined)
  return {
    externalId,
    components,
    capabilities,
  }
}
