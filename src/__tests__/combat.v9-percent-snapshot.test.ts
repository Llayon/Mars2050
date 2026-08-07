import { describe, expect, it } from 'vitest'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { EcsActionGroupLedger } from '@/domains/combat/combat.action-intent'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { commitV9ResolutionGroup } from '@/domains/combat/ecs/v9-defense-commit'
import { applyEcsTriggerDamage } from '@/domains/combat/ecs/systems/trigger-damage-system'

function unit(id: string, team: 'attacker' | 'defender'): SimUnit {
  return createRuntimeUnitFromConfig({ id, team, type: 'marine', x: 100, y: team === 'attacker' ? 100 : 106, currentAngle: 0 })!
}

describe('V9 percent current HP snapshot', () => {
  it('uses group-start HP for trigger percent damage', () => {
    const world = new CombatWorld([unit('attacker', 'attacker'), unit('target', 'defender')])
    const target = world.stores.vitality.require(1)
    target.hp = target.maxHp = 40
    world.resources.set('defenseResolutionMode', 'v9_snapshot')
    const ledger = new EcsActionGroupLedger()
    world.resources.set('actionGroup', ledger)
    ledger.begin(world, [0, 1], { tick: 0, phaseId: 'test', groupOrdinal: 0 })
    target.hp = 10
    const actions: Parameters<typeof applyEcsTriggerDamage>[4] = []

    applyEcsTriggerDamage(world, 0, 1, {
      kind: 'damage', target: 'target', percentHp: { percent: 0.5, maxBonus: 100 },
    }, actions)
    commitV9ResolutionGroup(world, ledger, actions)

    expect(target.hp).toBe(22)
    expect(actions).toContainEqual(expect.objectContaining({ type: 'percent_hp_damage', value: 20 }))
  })
})
