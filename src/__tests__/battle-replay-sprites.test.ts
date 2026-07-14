import { describe, expect, it } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { SPRITE_DIRS } from '@/domains/combat/combat.utils'
import { getReplaySpriteDirection, resolveReplaySprite } from '@/components/game/battle-replay-sprites'
import type { ReplayUnit } from '@/components/game/battle-replay-canvas-types'
import {
  FORMER_REPLAY_ALIAS_UNITS,
  REPLAY_SPRITE_ALIASES,
  TIER1_DIRECT_VISUAL_UNITS,
  isReplayVisualCoverageExempt,
} from '@/components/game/battle-replay-visual-registry'

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

  it('resolves tier-1 infantry roles through direct visual assets', () => {
    TIER1_DIRECT_VISUAL_UNITS.forEach(type => {
      const sprite = resolveReplaySprite(type, 'south')
      expect(sprite, type).toMatchObject({
        assetType: type,
        kind: 'png',
      })
      expect(sprite?.src, type).not.toContain('undefined')
      expect(assetExists(sprite!.src), type).toBe(true)
    })
  })

  it('does not alias any current combat unit visuals', () => {
    const aliasedCurrentUnits = Object.keys(REPLAY_SPRITE_ALIASES)
      .filter(type => Object.prototype.hasOwnProperty.call(UNIT_TYPES, type))
    expect(aliasedCurrentUnits).toEqual([])
  })

  it('resolves former replay aliases through their own SVG strip assets', () => {
    FORMER_REPLAY_ALIAS_UNITS.forEach(type => {
      const sprite = resolveReplaySprite(type, 'south-east')
      expect(sprite, type).toMatchObject({
        src: `/assets/units/${type}_8dir.svg`,
        assetType: type,
        kind: 'svg-strip',
        frameIndex: 6,
        frameCount: 8,
      })
      expect(assetExists(sprite!.src), type).toBe(true)
    })
  })

  it('resolves newly promoted tier-1 assets without aliases', () => {
    expect(resolveReplaySprite('grenadier', 'south-west')).toMatchObject({
      src: '/assets/units/grenadier/south-west.png',
      assetType: 'grenadier',
      kind: 'png',
    })
    expect(resolveReplaySprite('sapper', 'east')).toMatchObject({
      src: '/assets/units/sapper/east.png',
      assetType: 'sapper',
      kind: 'png',
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

  it('resolves flamethrower through direct 8-direction PNG frames', () => {
    expect(resolveReplaySprite('flamethrower', 'north')).toMatchObject({
      src: '/assets/units/flamethrower/north.png',
      assetType: 'flamethrower',
      kind: 'png',
      frameIndex: 0,
    })
  })

  it('returns null for explicitly exempt unit types without a visual asset or alias', () => {
    expect(isReplayVisualCoverageExempt('wall')).toBe(true)
    expect(resolveReplaySprite('wall', 'north')).toBeNull()
  })

  it('keeps every combat unit visual-covered or explicitly exempt', () => {
    Object.keys(UNIT_TYPES).forEach(type => {
      if (isReplayVisualCoverageExempt(type)) {
        expect(resolveReplaySprite(type, 'south'), type).toBeNull()
        return
      }

      SPRITE_DIRS.forEach(direction => {
        const sprite = resolveReplaySprite(type, direction)
        expect(sprite, `${type}:${direction}`).not.toBeNull()
        expect(assetExists(sprite!.src), sprite!.src).toBe(true)
      })
    })
  })

  it('uses movement direction before stationary team defaults', () => {
    expect(getReplaySpriteDirection(unit({ sX: 20, sY: 20, tX: 80, tY: 20 }))).toBe('east')
    expect(getReplaySpriteDirection(unit({ team: 'attacker' }))).toBe('north')
    expect(getReplaySpriteDirection(unit({ team: 'defender' }))).toBe('south')
  })
})

function assetExists(publicPath: string): boolean {
  return existsSync(join(process.cwd(), 'public', publicPath.replace(/^\//, '')))
}
