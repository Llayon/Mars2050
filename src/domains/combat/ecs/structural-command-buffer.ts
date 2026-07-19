import type { SimHazard, SimUnit } from '../combat.sim.types'
import type { CombatWorld } from './combat-world'

export type StructuralCommand =
  | { type: 'create_unit'; unit: SimUnit }
  | { type: 'create_hazard'; hazard: SimHazard }

export class StructuralCommandBuffer {
  private commands: StructuralCommand[] = []

  queueUnit(unit: SimUnit): void {
    this.commands.push({ type: 'create_unit', unit })
  }

  queueHazard(hazard: SimHazard): void {
    this.commands.push({ type: 'create_hazard', hazard })
  }

  drain(): StructuralCommand[] {
    const commands = this.commands
    this.commands = []
    return commands
  }

  flush(world: CombatWorld): void {
    for (const command of this.drain()) {
      if (command.type === 'create_unit') {
        if (world.getEntityId(command.unit.id) === undefined) {
          world.createUnitEntity(command.unit)
        }
        continue
      }
      if (world.getEntityId(command.hazard.id) === undefined) {
        world.createHazardEntity(command.hazard)
      }
    }
  }
}
