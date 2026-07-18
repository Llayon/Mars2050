import type { BattleAction } from '../../combat.actions'
import type { RuntimeActionContext } from '../../combat.runtime'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { runEcsPeriodicSpawnAction } from './spawn-action-system'

export function runEcsPeriodicSpawnerSystem(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
  actions: BattleAction[],
  context: RuntimeActionContext,
): void {
  const lifecycle = world.stores.lifecycle.require(entityId)
  const spawner = lifecycle.spawnerConfig
  if (!spawner) return

  spawner.timer--
  if (spawner.timer > 0) return
  spawner.timer = spawner.interval
  runEcsPeriodicSpawnAction(
    world,
    entityId,
    targetId,
    actions,
    context,
    spawner.unitType,
  )
}
