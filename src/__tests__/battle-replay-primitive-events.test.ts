import { describe, expect, it } from 'vitest'
import { handlePrimitiveReplayEvent } from '@/components/game/battle-replay-primitive-events'
import type { BattleAction } from '@/domains/combat/combat.types'
import type { SpriteState } from '@/components/game/battle-replay-units'

function sprite(x = 10, y = 20, team: 'attacker' | 'defender' = 'attacker'): SpriteState {
  return { c: { x, y } as SpriteState['c'], hpBar: {} as SpriteState['hpBar'], hp: 100, maxHp: 100, prog: 1, sX: x, sY: y, tX: x, tY: y, type: 'marine', team }
}

function render(action: BattleAction): { handled: boolean; texts: string[]; projectiles: number } {
  const source = sprite()
  const target = sprite(40, 50, 'defender')
  const texts: string[] = []
  let projectiles = 0
  const handled = handlePrimitiveReplayEvent(
    action,
    source,
    { target },
    text => { texts.push(text) },
    () => { projectiles++ }
  )
  return { handled, texts, projectiles }
}

describe('battle replay primitive events', () => {
  it('renders movement stealth and transform state changes', () => {
    expect(render({ unitId: 'source', type: 'stealth_change', modeState: 'movement_active' }).texts).toEqual(['СКРЫТ'])
    expect(render({ unitId: 'source', type: 'stealth_change', modeState: 'movement_inactive' }).texts).toEqual(['ОБНАРУЖЕН'])
    expect(render({ unitId: 'source', type: 'transform_mode' }).texts).toEqual(['ТРАНСФОРМ'])
  })

  it('renders projectile interception and control conversion affordances', () => {
    const intercept = render({ unitId: 'source', type: 'projectile_intercept', targetId: 'target', fromX: 0, fromY: 0, toX: 40, toY: 50 })
    const convert = render({ unitId: 'source', type: 'control_convert', targetId: 'target' })

    expect(intercept).toMatchObject({ handled: true, texts: ['ПЕРЕХВАТ'], projectiles: 1 })
    expect(convert).toMatchObject({ handled: true, texts: ['КОНТРОЛЬ'] })
  })

  it('renders trigger, periodic, cleanse, barrier, and shield block affordances', () => {
    expect(render({ unitId: 'source', type: 'periodic_ability', statusType: 'spawn' }).texts).toEqual(['ВОЛНА'])
    expect(render({ unitId: 'source', type: 'trigger_effect', statusType: 'on-death-spawn' }).texts).toEqual(['ПОСМЕРТНО'])
    expect(render({ unitId: 'source', type: 'hazard_cleanse' }).texts).toEqual(['ОЧИСТКА'])
    expect(render({ unitId: 'source', type: 'barrier_spawn' }).texts).toEqual(['БАРЬЕР'])
    expect(render({ unitId: 'source', type: 'shield_hit_block' }).texts).toEqual(['ЩИТ БЛОК'])
  })
})
