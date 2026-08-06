import type { SimHazard } from '../combat.sim.types'
import type { CombatWorld } from './combat-world'
import type { UnitCloneData } from './unit-clone'
import type { UnitEntityBundle } from './unit-entity-bundle'

export type StructuralCommand =
  | { type: 'create_unit'; bundle: UnitEntityBundle }
  | { type: 'create_unit_clone'; clone: UnitCloneData }
  | { type: 'create_hazard'; hazard: SimHazard }
  | { type: 'remove_hazard'; entityId: number }

export class StructuralCommandBuffer {
  private commands: StructuralCommand[] = []
  private readonly pendingHazardRemovals = new Set<number>()

  queueUnit(bundle: UnitEntityBundle): void {
    this.commands.push({ type: 'create_unit', bundle })
  }

  queueHazard(hazard: SimHazard): void {
    this.commands.push({ type: 'create_hazard', hazard: structuredClone(hazard) })
  }

  queueUnitClone(clone: UnitCloneData): void {
    this.commands.push({ type: 'create_unit_clone', clone: structuredClone(clone) })
  }

  queueHazardRemoval(entityId: number): void {
    if (this.pendingHazardRemovals.has(entityId)) return
    this.pendingHazardRemovals.add(entityId)
    this.commands.push({ type: 'remove_hazard', entityId })
  }

  drain(): StructuralCommand[] {
    const commands = this.commands
    this.commands = []
    this.pendingHazardRemovals.clear()
    return commands
  }

  flush(world: CombatWorld): void {
    for (const command of this.drain()) {
      if (command.type === 'create_unit') {
        world.createUnitEntity(command.bundle)
        continue
      }
      if (command.type === 'create_unit_clone') {
        world.createClonedUnitEntity(command.clone)
        continue
      }
      if (command.type === 'remove_hazard') {
        world.removeHazardEntity(command.entityId)
        continue
      }
      world.createHazardEntity(command.hazard)
    }
  }
}
