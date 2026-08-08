import { describe, expect, it } from 'vitest'
import type { BattleAction, BattleResult } from '@/domains/combat/combat.types'
import type { CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import type { Team, UnitRow } from '@/domains/combat/combat.types'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { runCertifiedProductionCombat } from './helpers/combat-production-runner'
import { applyOrientationProbe } from './helpers/combat-orientation-probes'

describe('V9 same-initiative spatial and action semantics', () => {
  it('keeps mutual-kill HP and death semantics under row and external-ID permutations', () => {
    const scenario = mutualKillScenario()
    const baseline = runProbe(scenario, 'baseline')
    const reversed = runProbe(scenario, 'input_order_reversed')
    const permuted = runProbe(scenario, 'external_id_permuted')

    expect(projectedState(baseline.result, baseline.probe.semanticByExternalId))
      .toEqual(projectedState(reversed.result, reversed.probe.semanticByExternalId))
    expect(projectedState(baseline.result, baseline.probe.semanticByExternalId))
      .toEqual(projectedState(permuted.result, permuted.probe.semanticByExternalId))
    expect(baseline.result.winner).toBe(reversed.result.winner)
    expect(baseline.result.winner).toBe(permuted.result.winner)
  })

  it('characterizes displacement out of range for a later same-initiative peer', () => {
    const result = runScenario(displacementOutScenario())
    const sonicMove = findActionWithTick(result, action => action.type === 'knockback')
    const peerDamage = sonicMove === undefined
      ? undefined
      : findActionAtTick(result, sonicMove.tick, action => action.unitId === 'b-goliath' && action.type === 'damage')

    expect(sonicMove?.action).toBeDefined()
    expect(peerDamage?.action).toBeDefined()
  })

  it('characterizes displacement into range for a later same-initiative peer', () => {
    const result = runScenario(displacementInScenario())
    const pull = findActionWithTick(result, action => action.type === 'move')
    const peerDamage = pull === undefined
      ? undefined
      : findActionAtTick(result, pull.tick, action => action.unitId === 'b-walker' && action.type === 'damage')

    expect(pull?.action).toBeDefined()
    expect(peerDamage?.action).toBeUndefined()
  })

  it('characterizes target mark visibility before same-group commit', () => {
    const result = runScenario(targetMarkScenario())
    const mark = findActionWithTick(result, action => action.type === 'target_mark')
    const peerDamage = mark === undefined
      ? undefined
      : findActionAtTick(result, mark.tick, action => action.unitId.startsWith('b-marine_') && action.type === 'damage')

    expect(mark?.action).toBeDefined()
    expect(peerDamage?.action).toBeDefined()
    expect(peerDamage?.action.bonusDamage).toBeUndefined()
  })

  it('characterizes ordinary status visibility separately from target marks', () => {
    const result = runScenario(ordinaryStatusScenario())
    const status = findActionWithTick(result, action => action.type === 'status_apply')
    const peerDamage = status === undefined
      ? undefined
      : findActionAtTick(result, status.tick, action => action.unitId === 'b-sonic' && action.type === 'damage')

    expect(status?.action).toBeDefined()
    expect(peerDamage?.action).toBeDefined()
    expect(peerDamage?.action.bonusDamage).toBeUndefined()
  })

  it('keeps semantic target selection stable under candidate input order', () => {
    const scenario = targetTieScenario()
    const normal = runProbe(scenario, 'baseline')
    const reversed = runProbe(scenario, 'input_order_reversed')
    const normalTarget = firstDamageTarget(normal.result, 'a-tie')
    const reversedTarget = firstDamageTarget(reversed.result, 'a-tie')

    expect(normalTarget).toBe('target-left')
    expect(reversedTarget).toBe(normalTarget)
  })

  it('characterizes external lexical ID ordering for equal target ties', () => {
    const scenario = targetTieScenario()
    const baseline = runProbe(scenario, 'baseline')
    const permuted = runProbe(scenario, 'external_id_permuted')
    const baselineTarget = firstDamageTarget(baseline.result, 'a-tie')
    const permutedAttackerId = externalIdForOriginal(permuted.probe, 'a-tie')
    const permutedTarget = firstDamageTarget(permuted.result, permutedAttackerId)
    const baselineSemantic = baseline.probe.semanticByExternalId.get(baselineTarget)
    const permutedSemantic = permuted.probe.semanticByExternalId.get(permutedTarget)

    expect(baselineSemantic?.originalRowId).toBe('target-left')
    expect(permutedSemantic?.originalRowId).toBe('target-right')
  })
})

function runProbe(
  scenario: CombatBalanceScenario,
  transform: Parameters<typeof applyOrientationProbe>[1],
): { result: BattleResult; probe: ReturnType<typeof applyOrientationProbe> } {
  const probe = applyOrientationProbe(scenario, transform)
  return {
    probe,
    result: runCertifiedProductionCombat(probe.attackers, probe.defenders, 101, [], [], [], { maxTicks: 80 }),
  }
}

function runScenario(scenario: CombatBalanceScenario): BattleResult {
  return runCertifiedProductionCombat(scenario.attackers, scenario.defenders, 101, [], [], [], { maxTicks: 80 })
}

function projectedState(result: BattleResult, mapping: ReadonlyMap<string, { originalRole: Team; originalRowId: string; memberOrdinal: number }>): Array<{ key: string; alive: boolean; hp: number }> {
  const survivors = new Map(result.survivors.map(unit => [unit.id, unit]))
  return result.initialState
    .map(unit => {
      const identity = mapping.get(unit.id)
      const key = identity === undefined
        ? unit.id
        : `${identity.originalRole}:${identity.originalRowId}:${identity.memberOrdinal}`
      const survivor = survivors.get(unit.id)
      return { key, alive: survivor !== undefined, hp: survivor?.hp ?? 0 }
    })
    .sort((left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0)
}

function findAction(result: BattleResult, predicate: (action: BattleAction) => boolean): BattleAction | undefined {
  return result.logs.flatMap(tick => tick.actions).find(predicate)
}

function findActionWithTick(result: BattleResult, predicate: (action: BattleAction) => boolean): { tick: number; action: BattleAction } | undefined {
  for (const tick of result.logs) {
    const action = tick.actions.find(predicate)
    if (action !== undefined) return { tick: tick.tick, action }
  }
  return undefined
}

function findActionAtTick(result: BattleResult, tickNumber: number, predicate: (action: BattleAction) => boolean): { tick: number; action: BattleAction } | undefined {
  const tick = result.logs.find(item => item.tick === tickNumber)
  const action = tick?.actions.find(predicate)
  return action === undefined ? undefined : { tick: tickNumber, action }
}

function firstDamageTarget(result: BattleResult, sourcePrefix: string): string {
  const action = findAction(result, action => action.unitId.startsWith(sourcePrefix) && action.type === 'damage')
  if (!action?.targetId) throw new Error(`Expected damage action from ${sourcePrefix}`)
  return action.targetId
}

function externalIdForOriginal(probe: ReturnType<typeof applyOrientationProbe>, originalRowId: string): string {
  const entry = [...probe.semanticByExternalId.entries()]
    .find(([, identity]) => identity.originalRowId === originalRowId && identity.memberOrdinal === 0)
  if (!entry) throw new Error(`Expected external ID for ${originalRowId}`)
  return entry[0]
}

function row(id: string, team: Team, unitType: UnitRow['unit_type'], x: number, y: number, hp = UNIT_TYPES[unitType].baseStats.hp): UnitRow {
  return { id, colony_id: team, unit_type: unitType, hp_current: hp, tier: 1, upgrade_path: [], grid_x: String(x), grid_y: String(y) }
}

function scenario(id: string, attackers: UnitRow[], defenders: UnitRow[]): CombatBalanceScenario {
  return { id, name: id, attackers, defenders }
}

function mutualKillScenario(): CombatBalanceScenario {
  return scenario('micro-mutual-kill', [
    row('a-left', 'attacker', 'light_walker', 250, 420, 40),
    row('a-right', 'attacker', 'light_walker', 350, 420, 40),
  ], [
    row('d-left', 'defender', 'light_walker', 250, 580, 40),
    row('d-right', 'defender', 'light_walker', 350, 580, 40),
  ])
}

function displacementOutScenario(): CombatBalanceScenario {
  return scenario('micro-displacement-out', [
    row('a-sonic', 'attacker', 'sonic_devastator', 200, 300),
    row('b-goliath', 'attacker', 'goliath_gunship', 220, 300),
  ], [row('x-target', 'defender', 'light_walker', 200, 500, 1000)])
}

function displacementInScenario(): CombatBalanceScenario {
  return scenario('micro-displacement-in', [
    row('a-gravity', 'attacker', 'gravity_manipulator', 200, 300),
    row('b-walker', 'attacker', 'light_walker', 320, 300),
  ], [row('x-target', 'defender', 'light_walker', 200, 490, 1000)])
}

function targetMarkScenario(): CombatBalanceScenario {
  return scenario('micro-target-mark', [
    row('a-mark', 'attacker', 'bounty_hunter', 200, 300),
    row('b-marine', 'attacker', 'marine', 220, 300),
  ], [row('x-target', 'defender', 'light_walker', 200, 410, 1000)])
}

function ordinaryStatusScenario(): CombatBalanceScenario {
  return scenario('micro-ordinary-status', [
    row('a-ion', 'attacker', 'ion_crawler', 200, 300),
    row('b-sonic', 'attacker', 'sonic_devastator', 220, 300),
  ], [row('x-target', 'defender', 'light_walker', 200, 450, 1000)])
}

function targetTieScenario(): CombatBalanceScenario {
  return scenario('micro-target-tie', [row('a-tie', 'attacker', 'light_walker', 300, 300)], [
    row('target-left', 'defender', 'light_walker', 240, 420, 1000),
    row('target-right', 'defender', 'light_walker', 360, 420, 1000),
  ])
}
