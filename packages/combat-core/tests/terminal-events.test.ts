import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  decodeLegacyReplayJson, encodeLegacyReplayJson, simulateCombat,
  type BattleInput, type CombatRunResult, type DefenseResolutionMode, type UnitDefinition,
} from '../src/index.js'

function terminalInput(mode: DefenseResolutionMode, delay = 2, burn = true): BattleInput {
  const definition = (id: string, hp: number, damage: number): UnitDefinition => ({
    id, name: id, squadSize: 1, squadSpacing: 20, formation: 'grid',
    baseStats: {
      hp, attack: 1, defense: 0, speed: 0, range: 1, attackType: 'single', size: 'M',
      actionCooldownMax: 10, turnSpeed: 5, combatTags: [],
      periodicAbilities: burn ? [{
        id: `${id}-burn`, intervalTicks: 50, initialDelayTicks: delay, targetPolicy: 'self',
        payload: { kind: 'status', effects: [{ type: 'burn', duration: 10, value: damage, tickInterval: 1 }] },
      }] : [],
    },
  })
  return {
    seed: 1, arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
    rules: { maxTicks: 5, timeoutPolicy: 'draw', defenseResolutionMode: mode, trackMetrics: true },
    definitions: { a: definition('a', 100, 5), b: definition('b', 1, 1) },
    units: [
      { instanceId: 'a1', definitionId: 'a', team: 'attacker', rank: 1, upgradeIds: [], placement: { x: 300, y: 1000 } },
      { instanceId: 'b1', definitionId: 'b', team: 'defender', rank: 1, upgradeIds: [], placement: { x: 300, y: 200 } },
    ],
    scheduledEffects: [],
  }
}

function expectReplayHp(result: CombatRunResult): void {
  for (const survivor of result.survivors) {
    const initial = result.initialState.find(unit => unit.id === survivor.id)!
    let hp = initial.hp
    for (const tick of result.logs) for (const action of tick.actions) {
      if (action.targetId !== survivor.id) continue
      if (action.type === 'damage') hp = Math.max(0, hp - z.number().parse(action.damage ?? 0))
      if (action.type === 'heal') hp = Math.min(initial.maxHp, hp + z.number().parse(action.damage ?? 0))
    }
    expect(hp, `Event HP for ${survivor.id}`).toBe(survivor.hp)
  }
}

describe.each(['v8_sequential', 'v9_snapshot'] as const)('Terminal events in %s', mode => {
  it.each([0, 2])('records terminal pre_action once, including tick %i', delay => {
    const input = terminalInput(mode, delay)
    const before = structuredClone(input)
    const result = simulateCombat(input)
    expect(input).toEqual(before)
    expect(result.winner).toBe('attacker')
    expect(result.survivors.map(unit => [unit.id, unit.hp])).toEqual([['a1', 95]])
    expectReplayHp(result)
    const terminal = result.logs.find(entry => entry.tick === delay)!
    expect(terminal).toBeDefined()
    expect(terminal.actions.filter(action => action.type === 'damage')).toHaveLength(2)
    expect(terminal.actions.filter(action => action.type === 'die')).toHaveLength(1)
    expect(terminal.actions.some(action => action.type === 'attack' || action.type === 'move')).toBe(false)
    expect(result.logs.filter(entry => entry.tick === delay)).toHaveLength(1)
    expect(result.elapsedTicks).toBe(delay + 1)
    expect(result.logs.every(entry => entry.tick < result.elapsedTicks)).toBe(true)
    const metrics = z.object({
      damageByUnitType: z.record(z.string(), z.number()), battleDurationTicks: z.number(),
    }).parse(result.metrics)
    expect(Object.values(metrics.damageByUnitType).reduce((sum, damage) => sum + damage, 0)).toBe(6)
    expect(metrics.battleDurationTicks).toBe(result.elapsedTicks)
    const encoded = encodeLegacyReplayJson(result)
    expect(encodeLegacyReplayJson(decodeLegacyReplayJson(encoded))).toBe(encoded)
    expect(simulateCombat(before)).toEqual(result)
  })

  it('keeps the no-burn control consistent through timeout', () => {
    const result = simulateCombat(terminalInput(mode, 2, false))
    expect(result.winner).toBe('draw')
    expect(result.elapsedTicks).toBe(5)
    expect(result.survivors.map(unit => unit.hp)).toEqual([100, 1])
    expect(result.logs.flatMap(entry => entry.actions).filter(action => action.statusType === 'burn')).toEqual([])
    expectReplayHp(result)
  })

  it('does not invent a tick for an empty terminal check', () => {
    const input = terminalInput(mode, 2, false)
    input.units = []
    const result = simulateCombat(input)
    expect(result.elapsedTicks).toBe(0)
    expect(result.logs).toEqual([])
  })

  it('records terminal events without metrics or profile', () => {
    const input = terminalInput(mode)
    input.rules.trackMetrics = false
    input.rules.profile = false
    const result = simulateCombat(input)
    expect(result.profile).toBeUndefined()
    expect(result.metrics).toBeUndefined()
    expect(result.logs.at(-1)?.tick).toBe(2)
    expectReplayHp(result)
  })
})
