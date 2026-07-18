import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

export function runEcsGrowthAndChargeSystem(
  world: CombatWorld,
  tick: number,
  actions: BattleAction[],
  entityIds = getEcsGrowthAndChargeEntities(world),
): void {
  const ordered = [...entityIds]
    .sort((left, right) =>
      world.stores.identity.require(left).id.localeCompare(
        world.stores.identity.require(right).id,
      ),
    )
  for (const entityId of ordered) {
    processStatGrowth(world, entityId, tick, actions)
    processAttackCharge(world, entityId, tick, actions)
  }
}

export function getEcsGrowthAndChargeEntities(
  world: CombatWorld,
): EntityId[] {
  return world.query(['identity', 'vitality', 'combat', 'lifecycle'])
    .filter(entityId => {
      const lifecycle = world.stores.lifecycle.require(entityId)
      return Boolean(lifecycle.statGrowth || lifecycle.attackCharge)
    })
}

function processStatGrowth(
  world: CombatWorld,
  entityId: EntityId,
  tick: number,
  actions: BattleAction[],
): void {
  const growth = world.stores.lifecycle.require(entityId).statGrowth
  if (!growth || tick < growth.nextTick || growth.stacks >= growth.maxStacks) return

  const combat = world.stores.combat.require(entityId)
  const vitality = world.stores.vitality.require(entityId)
  growth.stacks++
  growth.nextTick = tick + Math.max(1, growth.intervalTicks)
  const oldMaxHp = vitality.maxHp
  if (growth.attackMultPerStack) {
    combat.attack = Math.max(
      1,
      Math.floor(combat.attack * (1 + growth.attackMultPerStack)),
    )
  }
  if (growth.hpMultPerStack) {
    vitality.maxHp = Math.max(
      1,
      Math.floor(vitality.maxHp * (1 + growth.hpMultPerStack)),
    )
    vitality.hp = Math.min(
      vitality.maxHp,
      vitality.hp + (vitality.maxHp - oldMaxHp),
    )
  }
  actions.push({
    unitId: world.stores.identity.require(entityId).id,
    type: 'stat_growth',
    value: growth.stacks,
  })
}

function processAttackCharge(
  world: CombatWorld,
  entityId: EntityId,
  tick: number,
  actions: BattleAction[],
): void {
  const charge = world.stores.lifecycle.require(entityId).attackCharge
  if (!charge || tick < charge.nextTick || charge.stacks >= charge.maxStacks) return
  charge.stacks++
  charge.nextTick = tick + Math.max(1, charge.intervalTicks)
  actions.push({
    unitId: world.stores.identity.require(entityId).id,
    type: 'attack_charge',
    value: charge.stacks,
  })
}
