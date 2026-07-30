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
})
