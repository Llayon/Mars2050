import { describe, expect, it } from 'vitest'
import type { ReplayUnit } from '@/components/game/battle-replay-canvas-types'
import {
  resolveReplayAnimationFrame,
  resolveReplayVisualClipFrame,
} from '@/components/game/battle-replay-visual-clips'
import {
  createReplayUnitVisualState,
  markReplayUnitAttack,
  markReplayUnitDeath,
  markReplayUnitMovement,
  resolveReplayUnitVisualState,
} from '@/components/game/battle-replay-visual-state'

function createUnit(): ReplayUnit {
  return {
    id: 'source',
    type: 'marine',
    team: 'attacker',
    hp: 35,
    maxHp: 35,
    size: 'S',
    sX: 100,
    sY: 100,
    tX: 100,
    tY: 100,
    isDead: false,
    isFlying: false,
    emp: false,
    stealth: false,
    flash: 0,
    visual: createReplayUnitVisualState('attacker'),
  }
}

describe('deterministic replay visual state', () => {
  it('faces a stationary attacker toward its target', () => {
    const unit = createUnit()
    expect(resolveReplayUnitVisualState(unit, 500).elapsedMs).toBe(500)
    markReplayUnitAttack(unit, 200, 100, 150)

    expect(resolveReplayUnitVisualState(unit, 150)).toEqual({
      clip: 'attack',
      direction: 'east',
      elapsedMs: 0,
    })
    expect(resolveReplayUnitVisualState(unit, 369).clip).toBe('attack')
    expect(resolveReplayUnitVisualState(unit, 370)).toEqual({
      clip: 'idle',
      direction: 'east',
      elapsedMs: 220,
    })
  })

  it('uses death before attack and movement', () => {
    const unit = createUnit()
    markReplayUnitMovement(unit, 100, 100, 140, 60, 100)
    unit.tX = 140
    unit.tY = 60
    markReplayUnitAttack(unit, 200, 60, 150)
    unit.isDead = true
    markReplayUnitDeath(unit, 175)

    expect(resolveReplayUnitVisualState(unit, 180)).toEqual({
      clip: 'death',
      direction: 'east',
      elapsedMs: 5,
    })
  })

  it('keeps fallback assets on a deterministic idle frame', () => {
    expect(
      resolveReplayVisualClipFrame('marine', 'walk', 'south-west', 800),
    ).toEqual({
      clip: 'idle',
      animationFrame: 0,
      atlasFrame: 0,
    })
  })

  it('resolves looping and one-shot atlas frame timing', () => {
    const loop = {
      startFrame: 0,
      frameCount: 4,
      fps: 8,
      loop: true,
    }
    const oneShot = { ...loop, loop: false }

    expect(resolveReplayAnimationFrame(loop, 0)).toBe(0)
    expect(resolveReplayAnimationFrame(loop, 500)).toBe(0)
    expect(resolveReplayAnimationFrame(oneShot, 500)).toBe(3)
    expect(resolveReplayAnimationFrame(oneShot, 5000)).toBe(3)
  })
})
