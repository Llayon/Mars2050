import { describe, expect, it } from 'vitest'
import { getReplaySpriteDirection, resolveReplaySprite } from '@/components/game/battle-replay-sprites'
import type { ReplayUnit } from '@/components/game/battle-replay-canvas-types'

function unit(overrides: Partial<ReplayUnit> = {}): ReplayUnit {
  return {
    id: 'unit',
    type: 'marine',
    team: 'attacker',
    hp: 10,
    maxHp: 10,
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
    ...overrides,
  }
}

describe('battle replay sprites', () => {
  it('resolves direct directional PNG sprites', () => {
    expect(resolveReplaySprite('marine', 'north')).toMatchObject({
      src: '/sprites/marine/rotations/north.png',
      assetType: 'marine',
      kind: 'png',
      frameIndex: 0,
    })
  })

  it('resolves temporary tier-1 visual aliases to existing assets', () => {
    expect(resolveReplaySprite('grenadier', 'south-west')).toMatchObject({
      src: '/sprites/rocketeer/south-west.png',
      assetType: 'rocketeer',
      kind: 'png',
    })
    expect(resolveReplaySprite('sapper', 'east')).toMatchObject({
      src: '/assets/units/engineer_8dir.svg',
      assetType: 'engineer',
      kind: 'svg-strip',
    })
  })

  it('resolves advanced units from SVG strips with deterministic frame indexes', () => {
    expect(resolveReplaySprite('engineer', 'south-east')).toMatchObject({
      src: '/assets/units/engineer_8dir.svg',
      assetType: 'engineer',
      kind: 'svg-strip',
      frameIndex: 6,
      frameCount: 8,
    })
  })

  it('resolves atlas-backed idle frames without loading atlas JSON in replay', () => {
    expect(resolveReplaySprite('flamethrower', 'north')).toMatchObject({
      src: '/sprites/units/flamethrower.png',
      assetType: 'flamethrower',
      kind: 'atlas',
      frameIndex: 3,
      sourceWidth: 128,
    })
  })

  it('returns null for unit types without a visual asset or alias', () => {
    expect(resolveReplaySprite('wall', 'north')).toBeNull()
  })

  it('uses movement direction before stationary team defaults', () => {
    expect(getReplaySpriteDirection(unit({ sX: 20, sY: 20, tX: 80, tY: 20 }))).toBe('east')
    expect(getReplaySpriteDirection(unit({ team: 'attacker' }))).toBe('north')
    expect(getReplaySpriteDirection(unit({ team: 'defender' }))).toBe('south')
  })
})
