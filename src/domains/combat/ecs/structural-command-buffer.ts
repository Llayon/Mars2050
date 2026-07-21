import type { SimHazard, SimUnit } from '../combat.sim.types'
import type { CombatWorld } from './combat-world'
import type { UnitCloneData } from './unit-clone'

export type StructuralCommand =
  | { type: 'create_unit'; unit: SimUnit }
  | { type: 'create_unit_clone'; clone: UnitCloneData }
  | { type: 'create_hazard'; hazard: SimHazard }

export class StructuralCommandBuffer {
  private commands: StructuralCommand[] = []

  queueUnit(unit: SimUnit): void {
    this.commands.push({ type: 'create_unit', unit: structuredClone(unit) })
  }

  queueHazard(hazard: SimHazard): void {
    this.commands.push({ type: 'create_hazard', hazard: structuredClone(hazard) })
  }

  queueUnitClone(clone: UnitCloneData): void {
    this.commands.push({ type: 'create_unit_clone', clone: structuredClone(clone) })
  }

  drain(): StructuralCommand[] {
    const commands = this.commands
    this.commands = []
    return commands
  }

  flush(world: CombatWorld): void {
    for (const command of this.drain()) {
      if (command.type === 'create_unit') {
        world.createUnitEntity(command.unit)
        continue
      }
      if (command.type === 'create_unit_clone') {
        world.createClonedUnitEntity(command.clone)
        continue
      }
      world.createHazardEntity(command.hazard)
    }
  }
}
