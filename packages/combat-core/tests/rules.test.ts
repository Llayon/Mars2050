import { describe, expect, it } from 'vitest'
import type { BattleInput, UnitDefinition } from '../src/contracts/index.js'
import { simulateCombat } from '../src/facade/combat-facade.js'

function def(id: string, over: Partial<UnitDefinition['baseStats']> = {}): UnitDefinition {
  return {
    id,
    name: id,
    baseStats: {
      hp: 10000, attack: 5, defense: 0, speed: 1, range: 1,
      attackType: 'single', actionCooldownMax: 10, turnSpeed: 5,
      size: 'M', combatTags: [], ...over,
    },
    squadSize: 1, squadSpacing: 20, formation: 'grid',
  }
}

const ARENA = { width: 600, height: 1200, tileSize: 40, obstacles: [] } as const

function farApart(seed: number, policy: BattleInput['rules']['timeoutPolicy'], maxTicks: number): ReturnType<typeof simulateCombat> {
  const a = def('a')
  const b = def('b')
  return simulateCombat({
    seed,
    arena: { ...ARENA, obstacles: [] },
    rules: { maxTicks, timeoutPolicy: policy, defenseResolutionMode: 'v9_snapshot' },
    definitions: { a, b },
    units: [
      { instanceId: 'a', definitionId: 'a', team: 'attacker', placement: { x: 300, y: 1100 }, rank: 1, upgradeIds: [] },
      { instanceId: 'b', definitionId: 'b', team: 'defender', placement: { x: 300, y: 100 }, rank: 1, upgradeIds: [] },
    ],
    scheduledEffects: [],
  })
}

describe('timeout and scheduled effects as data (ISO-03, ISO-04)', () => {
  it.each([
    ['draw', 'draw'],
    ['attacker_win', 'attacker'],
    ['defender_win', 'defender'],
  ] as const)('maps timeout policy %s to winner %s with exact reason and ticks', (policy, winner) => {
    const r = farApart(201, policy, 5)
    expect(r.winner).toBe(winner)
    expect(r.terminationReason).toBe('timeout')
    expect(r.elapsedTicks).toBe(5)
  })

  it('keeps terminal elimination instead of substituting timeout', () => {
    const glass = def('glass', { hp: 10, attack: 60, speed: 8, range: 6 })
    const victim = def('victim', { hp: 10, attack: 1, speed: 1, range: 1 })
    const r = simulateCombat({
      seed: 202,
      arena: { ...ARENA, obstacles: [] },
      rules: { maxTicks: 500, timeoutPolicy: 'attacker_win', defenseResolutionMode: 'v9_snapshot' },
      definitions: { glass, victim },
      units: [
        { instanceId: 'g', definitionId: 'glass', team: 'attacker', placement: { x: 300, y: 700 }, rank: 1, upgradeIds: [] },
        { instanceId: 'v', definitionId: 'victim', team: 'defender', placement: { x: 300, y: 650 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [],
    })
    expect(r.winner).toBe('attacker')
    expect(r.terminationReason).toBe('elimination')
    expect(r.elapsedTicks).toBeLessThan(500)
  })

  it('fires a scheduled strike exactly at the given tick, never early or twice', () => {
    const a = def('a')
    const b = def('b')
    const r = simulateCombat({
      seed: 203,
      arena: { ...ARENA, obstacles: [] },
      rules: { maxTicks: 200, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: { a, b },
      units: [
        { instanceId: 'a', definitionId: 'a', team: 'attacker', placement: { x: 300, y: 1100 }, rank: 1, upgradeIds: [] },
        { instanceId: 'b', definitionId: 'b', team: 'defender', placement: { x: 300, y: 100 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [{ id: 'strike1', tick: 5, team: 'attacker', type: 'orbital_strike', value: 10 }],
    })
    const strikes = r.logs.filter(t => t.actions.some(x => x.type === 'hazard_spawn')).map(t => t.tick)
    expect(strikes).toEqual([5])
  })

  it('fires truly simultaneous effects sharing one tick with preserved order and verified attribution', () => {
    const a = def('a', { hp: 500 })
    const b = def('b', { hp: 500 })
    const r = simulateCombat({
      seed: 204,
      arena: { ...ARENA, obstacles: [] },
      rules: { maxTicks: 20, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: { a, b },
      units: [
        { instanceId: 'a', definitionId: 'a', team: 'attacker', placement: { x: 300, y: 1100 }, rank: 1, upgradeIds: [], currentHp: 100 },
        { instanceId: 'b', definitionId: 'b', team: 'defender', placement: { x: 300, y: 100 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [
        { id: 'emp_same', tick: 5, team: 'attacker', type: 'global_emp', value: 3 },
        { id: 'heal_same', tick: 5, team: 'attacker', type: 'mass_heal', value: 40 },
      ],
    })
    const tick5Log = r.logs.find(l => l.tick === 5)
    expect(tick5Log).toBeDefined()
    const actions = tick5Log!.actions

    const empIndex = actions.findIndex(x => x.type === 'status_apply' && (x as { statusType?: string }).statusType === 'emp')
    const healIndex = actions.findIndex(x => x.type === 'heal')
    expect(empIndex).toBeGreaterThanOrEqual(0)
    expect(healIndex).toBeGreaterThanOrEqual(0)
    // Order matches scheduledEffects declaration
    expect(empIndex).toBeLessThan(healIndex)

    // Verify attribution
    const empAction = actions[empIndex] as { unitId?: string; statusType?: string }
    expect(empAction.unitId).toBe('b')
    expect(empAction.statusType).toBe('emp')

    const healAction = actions[healIndex] as { targetId?: string; unitId?: string; damage?: number }
    expect(healAction.targetId).toBe('a')
    expect(healAction.unitId).toBe('system')
    expect(healAction.damage).toBe(40)

    // No emp or heal on other ticks
    const otherTicks = r.logs.filter(l => l.tick !== 5)
    expect(otherTicks.some(l => l.actions.some(a => a.type === 'heal' || (a.type === 'status_apply' && (a as { statusType?: string }).statusType === 'emp')))).toBe(false)
  })

  it('executes scheduled mass_shield at exact tick (0, 1, 5), strictly guarded before tick and granted once', () => {
    const a = def('a', { hp: 500 })
    const b = def('b', { hp: 500 })

    const runWithShield = (tick: number, maxTicks: number) => simulateCombat({
      seed: 205,
      arena: { ...ARENA, obstacles: [] },
      rules: { maxTicks, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: { a, b },
      units: [
        { instanceId: 'a', definitionId: 'a', team: 'attacker', placement: { x: 300, y: 1100 }, rank: 1, upgradeIds: [] },
        { instanceId: 'b', definitionId: 'b', team: 'defender', placement: { x: 300, y: 100 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [{ id: 'shield', tick, team: 'attacker', type: 'mass_shield', value: 60 }],
    })

    // Tick 0: applied on tick 0 even with maxTicks: 1
    const r0 = runWithShield(0, 1)
    const u0 = r0.survivors.find(u => u.id === 'a')
    expect(u0?.maxShield).toBe(60)
    expect(u0?.shield).toBe(60)

    // Tick 1: before tick 1 (maxTicks: 1), no shield; after tick 1 (maxTicks: 2), shield is 60; at maxTicks: 10, shield is still 60 (granted once)
    const r1Before = runWithShield(1, 1)
    const u1Before = r1Before.survivors.find(u => u.id === 'a')
    expect(u1Before?.maxShield ?? 0).toBe(0)

    const r1After = runWithShield(1, 2)
    const u1After = r1After.survivors.find(u => u.id === 'a')
    expect(u1After?.maxShield).toBe(60)

    const r1Later = runWithShield(1, 10)
    const u1Later = r1Later.survivors.find(u => u.id === 'a')
    expect(u1Later?.maxShield).toBe(60) // Granted exactly once

    // Tick 5: before tick 5 (maxTicks: 5), no shield; at/after tick 5 (maxTicks: 6), shield is 60; at maxTicks: 15, shield is still 60
    const r5Before = runWithShield(5, 5)
    const u5Before = r5Before.survivors.find(u => u.id === 'a')
    expect(u5Before?.maxShield ?? 0).toBe(0)

    const r5After = runWithShield(5, 6)
    const u5After = r5After.survivors.find(u => u.id === 'a')
    expect(u5After?.maxShield).toBe(60)

    const r5Later = runWithShield(5, 15)
    const u5Later = r5Later.survivors.find(u => u.id === 'a')
    expect(u5Later?.maxShield).toBe(60) // Granted exactly once
  })

  it('does not apply scheduled mass_shield beyond battle duration', () => {
    const a = def('a', { hp: 500 })
    const b = def('b', { hp: 500 })
    const r = simulateCombat({
      seed: 205,
      arena: { ...ARENA, obstacles: [] },
      rules: { maxTicks: 1, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: { a, b },
      units: [
        { instanceId: 'a', definitionId: 'a', team: 'attacker', placement: { x: 300, y: 1100 }, rank: 1, upgradeIds: [] },
        { instanceId: 'b', definitionId: 'b', team: 'defender', placement: { x: 300, y: 100 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [{ id: 'shield100', tick: 100, team: 'attacker', type: 'mass_shield', value: 60 }],
    })
    const u = r.survivors.find(x => x.id === 'a')
    expect(u?.maxShield ?? 0).toBe(0)
    expect(u?.shield ?? 0).toBe(0)
  })

  it('rejects unknown scheduled effect kinds instead of no-op', () => {
    const a = def('a')
    const b = def('b')
    let code = ''
    try {
      simulateCombat({
        seed: 206,
        arena: { ...ARENA, obstacles: [] },
        rules: { maxTicks: 50, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
        definitions: { a, b },
        units: [
          { instanceId: 'a', definitionId: 'a', team: 'attacker', placement: { x: 300, y: 1100 }, rank: 1, upgradeIds: [] },
          { instanceId: 'b', definitionId: 'b', team: 'defender', placement: { x: 300, y: 100 }, rank: 1, upgradeIds: [] },
        ],
        scheduledEffects: [{ id: 'doom', tick: 5, team: 'attacker', type: 'doom_nova', value: 10 }],
      })
    } catch (err) {
      code = (err as { code?: string }).code ?? ''
    }
    expect(code).toBe('UNSUPPORTED_SCHEDULED_EFFECT')
  })
})
