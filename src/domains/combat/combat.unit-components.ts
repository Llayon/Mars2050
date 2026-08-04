import type {
  UnitCombatComponent,
  UnitIdentityComponent,
  UnitMovementComponent,
  UnitTargetingComponent,
  UnitTransformComponent,
  UnitVitalityComponent,
} from './combat.unit-core-components'
import type {
  UnitDefenseComponent,
  UnitLifecycleComponent,
  UnitStatusControlComponent,
  UnitSupportComponent,
  UnitWeaponComponent,
} from './combat.unit-ability-components'
import type { UnitRuntimeRules } from './combat.unit-build.types'

export interface UnitComponentDataMap {
  identity: Omit<UnitIdentityComponent, 'summonOwnerId'>
  transform: UnitTransformComponent
  vitality: UnitVitalityComponent
  combat: UnitCombatComponent
  weapon: UnitWeaponComponent
  targeting: Omit<UnitTargetingComponent,
    'attackTargetId' | 'rampTargetId' | 'meleeSlotTargetId' | 'meleeWaitingTargetId'>
  movement: Omit<UnitMovementComponent, 'lastProgressTargetId'>
  statusControl: UnitStatusControlComponent
  defense: UnitDefenseComponent
  support: UnitSupportComponent
  lifecycle: UnitLifecycleComponent
}

export type UnitSnapshot = UnitIdentityComponent & UnitTransformComponent &
  UnitVitalityComponent & UnitCombatComponent & UnitWeaponComponent &
  UnitTargetingComponent & UnitMovementComponent & UnitStatusControlComponent &
  UnitDefenseComponent & UnitSupportComponent & UnitLifecycleComponent & {
    runtimeRules?: UnitRuntimeRules
  }
export type UnitField = keyof UnitSnapshot
