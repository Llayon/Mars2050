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

export interface UnitComponentDataMap {
  identity: UnitIdentityComponent
  transform: UnitTransformComponent
  vitality: UnitVitalityComponent
  combat: UnitCombatComponent
  weapon: UnitWeaponComponent
  targeting: UnitTargetingComponent
  movement: UnitMovementComponent
  statusControl: UnitStatusControlComponent
  defense: UnitDefenseComponent
  support: UnitSupportComponent
  lifecycle: UnitLifecycleComponent
}

export type UnitSnapshot = UnitIdentityComponent & UnitTransformComponent &
  UnitVitalityComponent & UnitCombatComponent & UnitWeaponComponent &
  UnitTargetingComponent & UnitMovementComponent & UnitStatusControlComponent &
  UnitDefenseComponent & UnitSupportComponent & UnitLifecycleComponent
export type UnitField = keyof UnitSnapshot
