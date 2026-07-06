import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { handlePrimitiveReplayEvent } from '@/components/game/battle-replay-primitive-events'
import type { SpriteState } from '@/components/game/battle-replay-units'

function makeSprite(team: 'attacker' | 'defender' = 'attacker'): SpriteState {
  return { c: { x: 10, y: 20 }, hpBar: {}, hp: 100, maxHp: 100, prog: 1, sX: 10, sY: 20, tX: 10, tY: 20, type: 'marine', team } as unknown as SpriteState
}

describe('battle replay primitive events', () => {
  it('handles advanced primitive replay actions', () => {
    const source = makeSprite()
    const target = makeSprite('defender')
    const sprites = { source, target }
    const texts: string[] = []
    const projectiles: number[] = []
    const spawnTxt = (text: string) => texts.push(text)
    const spawnProj = () => projectiles.push(1)
    const actions: BattleAction[] = [
      { unitId: 'source', type: 'barrier_spawn' },
      { unitId: 'source', type: 'barrier_break' },
      { unitId: 'source', type: 'barrier_expire' },
      { unitId: 'source', type: 'stat_growth' },
      { unitId: 'source', type: 'attack_charge' },
      { unitId: 'source', type: 'attack_charge_release' },
      { unitId: 'source', type: 'reassembly_start' },
      { unitId: 'source', type: 'reassembly_complete' },
      { unitId: 'source', type: 'burrow_regen' },
      { unitId: 'source', type: 'emerge_strike' },
      { unitId: 'source', type: 'conditional_attack_mode', targetId: 'target' },
      { unitId: 'source', type: 'sweep_hit', targetId: 'target' },
    ]

    for (const action of actions) {
      expect(handlePrimitiveReplayEvent(action, source, sprites, spawnTxt, spawnProj)).toBe(true)
    }

    expect(texts).toContain('БАРЬЕР')
    expect(texts).toContain('ВОССТАНОВЛЕН')
    expect(projectiles).toHaveLength(2)
  })
})
