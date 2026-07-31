import { describe, expect, it } from 'vitest'
import { createBattleReplayRuntime } from '@/components/game/battle-replay-runtime'
import type { BattleTick, UnitRow } from '@/domains/combat/combat.types'

const unit: UnitRow = {
  id: 'source',
  colony_id: 'attacker',
  unit_type: 'marine',
  hp_current: 35,
  tier: 1,
  upgrade_path: [],
  grid_x: '200',
  grid_y: '700',
}

describe('battle replay runtime controls', () => {
  it('steps exactly one tick and preserves its transient effects while paused', () => {
    const logs: BattleTick[] = [{
      tick: 0,
      actions: [{
        unitId: 'source',
        type: 'field_effect',
        statusType: 'cleanse_field',
      }],
    }]
    const runtime = createBattleReplayRuntime({
      container: document.createElement('div'),
      attackerUnits: [unit],
      defenderUnits: [],
      logs,
    })

    runtime.controls.pause()
    runtime.controls.seekToTick(0)
    runtime.controls.stepTick()

    expect(runtime.controls.getCurrentTick()).toBe(1)
    expect(runtime.snapshot().texts).toContainEqual(expect.objectContaining({
      color: '#38bdf8',
      age: 0,
    }))
    expect(runtime.frame(performance.now() + 1000).texts).toHaveLength(1)
  })

  it('reuses its frame state and roster containers through spawn and seek', () => {
    const logs: BattleTick[] = [{
      tick: 0,
      actions: [{
        unitId: 'source',
        type: 'spawn',
        targetId: 'spawn-1',
        spawnType: 'marine',
        spawnTeam: 'attacker',
        toX: 220,
        toY: 680,
      }],
    }]
    const runtime = createBattleReplayRuntime({
      container: document.createElement('div'),
      attackerUnits: [unit],
      defenderUnits: [],
      logs,
    })
    const initialFrame = runtime.snapshot()
    const unitList = initialFrame.unitList
    const unitIndex = initialFrame.units

    runtime.controls.pause()
    runtime.controls.stepTick()

    expect(runtime.snapshot()).toBe(initialFrame)
    expect(runtime.snapshot().unitList).toBe(unitList)
    expect(runtime.snapshot().units).toBe(unitIndex)
    expect(unitList.map(item => item.id)).toEqual(['source', 'spawn-1'])
    expect(unitIndex['spawn-1']).toBe(unitList[1])

    runtime.controls.seekToTick(0)

    expect(runtime.frame(performance.now())).toBe(initialFrame)
    expect(unitList.map(item => item.id)).toEqual(['source'])
    expect(unitIndex['spawn-1']).toBeUndefined()
  })

  it('processes every action in a replay tick', () => {
    const secondUnit = {
      ...unit,
      id: 'second',
      grid_x: '300',
    }
    const logs: BattleTick[] = [{
      tick: 0,
      actions: [
        {
          unitId: 'source',
          type: 'move',
          fromX: 200,
          fromY: 700,
          toX: 205,
          toY: 695,
        },
        {
          unitId: 'second',
          type: 'move',
          fromX: 300,
          fromY: 700,
          toX: 295,
          toY: 705,
        },
      ],
    }]
    const runtime = createBattleReplayRuntime({
      container: document.createElement('div'),
      attackerUnits: [unit, secondUnit],
      defenderUnits: [],
      logs,
    })

    runtime.controls.pause()
    runtime.controls.seekToTick(1)

    expect(runtime.snapshot().units.source).toMatchObject({
      tX: 205,
      tY: 695,
    })
    expect(runtime.snapshot().units.second).toMatchObject({
      tX: 295,
      tY: 705,
    })
  })

  it('reconstructs attack facing and replay time through seek', () => {
    const target = {
      ...unit,
      id: 'target',
      colony_id: 'defender',
      grid_x: '400',
    }
    const logs: BattleTick[] = [{
      tick: 0,
      actions: [{
        unitId: 'source',
        targetId: 'target',
        type: 'attack',
        damage: 5,
      }],
    }]
    const runtime = createBattleReplayRuntime({
      container: document.createElement('div'),
      attackerUnits: [unit],
      defenderUnits: [target],
      logs,
    })

    runtime.controls.pause()
    runtime.controls.seekToTick(1)
    const sought = runtime.snapshot()

    expect(sought.replayTimeMs).toBe(150)
    expect(sought.units.source.visual.facing).toBe('east')
    expect(sought.units.source.visual.attackStartedAtMs).toBe(0)

    runtime.controls.seekToTick(0)
    expect(runtime.snapshot().replayTimeMs).toBe(0)
    expect(runtime.snapshot().units.source.visual).toMatchObject({
      facing: 'north',
      attackStartedAtMs: null,
    })
  })
})
