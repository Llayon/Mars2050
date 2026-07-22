import type { SimUnit } from '../combat.sim.types'
import type { CombatComponentStores, ComponentName } from './combat-components'
import type { EntityId } from './entity'
import { isQuerySpec, type QuerySpec } from './query-spec'

export class CombatEntityIndexes {
  private readonly summonsByOwner = new Map<EntityId, Set<EntityId>>()
  private readonly teamEntities: Record<SimUnit['team'], Set<EntityId>> = {
    attacker: new Set(),
    defender: new Set(),
  }

  constructor(private readonly stores: CombatComponentStores) {}

  addTeamEntity(entityId: EntityId, team: SimUnit['team']): void {
    this.teamEntities[team].add(entityId)
  }

  moveTeamEntity(
    entityId: EntityId,
    previous: SimUnit['team'],
    next: SimUnit['team'],
  ): void {
    this.teamEntities[previous].delete(entityId)
    this.teamEntities[next].add(entityId)
  }

  linkSummon(entityId: EntityId, ownerId: EntityId): void {
    const summons = this.summonsByOwner.get(ownerId)
    if (summons) summons.add(entityId)
    else this.summonsByOwner.set(ownerId, new Set([entityId]))
  }

  getActiveSummons(ownerId: EntityId): readonly EntityId[] {
    return [...(this.summonsByOwner.get(ownerId) ?? [])].filter(entityId =>
      this.stores.vitality.get(entityId)?.isDead === false,
    )
  }

  queryTeam(
    team: SimUnit['team'],
    query: readonly ComponentName[] | QuerySpec,
    includeDead: boolean,
  ): readonly EntityId[] {
    const components = isQuerySpec(query) ? query.components : query
    return [...this.teamEntities[team]].filter(entityId =>
      components.every(name => this.stores[name].has(entityId)) &&
      (includeDead || this.stores.vitality.get(entityId)?.isDead !== true),
    )
  }
}
