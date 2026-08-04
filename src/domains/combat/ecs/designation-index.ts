import type { Team } from '../combat.sim.types'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'
import type { TargetingScratch } from './targeting-scratch'

interface DesignationEntry {
  sourceId: EntityId
  team: Team
  squadId: string
  targetIds: EntityId[]
  focusRadius: number
}

export class DesignationIndex {
  private readonly bySource = new Map<EntityId, DesignationEntry>()

  set(
    sourceId: EntityId,
    team: Team,
    squadId: string,
    targetIds: EntityId[],
    focusRadius: number,
  ): void {
    this.bySource.set(sourceId, {
      sourceId,
      team,
      squadId,
      targetIds: [...targetIds],
      focusRadius: Math.max(0, focusRadius),
    })
  }

  clear(sourceId: EntityId): void {
    this.bySource.delete(sourceId)
  }

  appendAssistTargets(
    world: CombatWorld,
    team: Team,
    x: number,
    y: number,
    scratch: TargetingScratch,
  ): void {
    for (const entry of this.bySource.values()) {
      if (entry.team !== team || entry.focusRadius <= 0) continue
      let active = false
      for (const targetId of entry.targetIds) {
        const vitality = world.stores.vitality.get(targetId)
        const transform = world.stores.transform.get(targetId)
        const mark = world.stores.statusControl.get(targetId)?.targetMark
        if (!vitality || vitality.isDead || !transform || !mark ||
            mark.duration <= 0 ||
            world.stores.entitySources.get(targetId)?.targetMarkSource !== entry.sourceId) continue
        active = true
        const distance = Math.hypot(transform.x - x, transform.y - y)
        if (distance <= entry.focusRadius && !contains(scratch, targetId)) {
          scratch.push(targetId, distance)
        }
      }
      if (!active) this.bySource.delete(entry.sourceId)
    }
  }
}

export function getDesignationIndex(world: CombatWorld): DesignationIndex {
  const existing = world.resources.get('designationIndex')
  if (existing) return existing
  const created = new DesignationIndex()
  world.resources.set('designationIndex', created)
  return created
}

function contains(scratch: TargetingScratch, entityId: EntityId): boolean {
  for (let index = 0; index < scratch.length; index++) {
    if (scratch.entityIds[index] === entityId) return true
  }
  return false
}
