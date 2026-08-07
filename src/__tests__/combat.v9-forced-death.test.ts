import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { EcsActionGroupLedger } from '@/domains/combat/combat.action-intent'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { commitV9ResolutionGroup } from '@/domains/combat/ecs/v9-defense-commit'

function unit(id: string, team: SimUnit['team'], x: number): SimUnit {
  const result = createRuntimeUnitFromConfig({ id, team, type: 'marine', x, y: 100, currentAngle: 0 })!
  result.hp = 50
  result.maxHp = 100
  return result
}

function begin(world: CombatWorld): EcsActionGroupLedger {
  const ledger = new EcsActionGroupLedger()
  world.resources.set('defenseResolutionMode', 'v9_snapshot')
  world.resources.set('actionGroup', ledger)
  ledger.begin(world, world.query(['identity', 'vitality']), { tick: 0, phaseId: 'test', groupOrdinal: 0 })
  return ledger
}

describe('V9 forced death projection', () => {
  it('skips healing, status, and mark effects for a forced-dead target', () => {
    const world = new CombatWorld([unit('target', 'defender', 100)])
    const ledger = begin(world)
    const actions: BattleAction[] = []

    ledger.queueHealing(0, 'healer', 40)
    ledger.queueStatus(0, { type: 'range_boost', duration: 5, value: 1 })
    ledger.queueMark(0, { sourceExternalId: 'marker', sourceTeam: 'attacker', sourceUnitType: 'marine' }, {
      duration: 5,
      damageMultiplier: 0.5,
    })
    ledger.queueForcedDeath(0, {
      sourceExternalId: 'executioner',
      sourceTeam: 'attacker',
      sourceUnitType: 'marine',
    }, 'trigger')

    commitV9ResolutionGroup(world, ledger, actions)

    expect(world.stores.vitality.require(0)).toMatchObject({ hp: 0, isDead: true })
    expect(world.stores.statusControl.require(0).statusEffects).toEqual([])
    expect(world.stores.statusControl.require(0).targetMark).toBeUndefined()
    expect(actions.filter(action =>
      action.type === 'heal' ||
      action.type === 'status_apply' ||
      action.type === 'target_mark')).toEqual([])
    expect(actions.filter(action => action.type === 'die')).toHaveLength(1)
  })

  it('resolves forced death once with forced cause and attribution over lethal damage', () => {
    const world = new CombatWorld([unit('target', 'defender', 100)])
    const ledger = begin(world)
    const actions: BattleAction[] = []

    ledger.queueDamage(0, {
      sourceExternalId: 'damage-source',
      sourceTeam: 'attacker',
      sourceUnitType: 'marine',
    }, 100, 'weapon')
    ledger.queueForcedDeath(0, {
      sourceExternalId: 'forced-source',
      sourceTeam: 'attacker',
      sourceUnitType: 'marine',
    }, 'self_destruct')

    commitV9ResolutionGroup(world, ledger, actions)

    expect(actions.filter(action => action.type === 'die')).toEqual([
      expect.objectContaining({
        unitId: 'target',
        sourceUnitId: 'forced-source',
        cause: 'self_destruct',
      }),
    ])
  })

  it('resolves multiple forced deaths in external-ID order', () => {
    const world = new CombatWorld([
      unit('target:z', 'defender', 100),
      unit('target:a', 'defender', 120),
    ])
    const ledger = begin(world)
    const actions: BattleAction[] = []

    ledger.queueForcedDeath(0, undefined, 'trigger')
    ledger.queueForcedDeath(1, undefined, 'trigger')

    commitV9ResolutionGroup(world, ledger, actions)

    expect(actions.filter(action => action.type === 'die').map(action => action.unitId)).toEqual([
      'target:a',
      'target:z',
    ])
  })
})
