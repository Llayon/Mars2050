import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.types'
import { countActionsByType, countUnitsByTeamType, renderSnapshotJson } from '../../scripts/combat-snapshot'

describe('combat snapshot helpers', () => {
  it('counts selected replay actions with deterministic zero entries', () => {
    const actions: BattleAction[] = [
      { unitId: 'a', type: 'damage' },
      { unitId: 'b', type: 'spawn' },
      { unitId: 'c', type: 'damage' },
    ]

    expect(countActionsByType(actions, ['damage', 'heal', 'spawn'])).toEqual({
      damage: 2,
      heal: 0,
      spawn: 1,
    })
  })

  it('sorts team/type unit counts for stable snapshots', () => {
    const units = [
      { team: 'defender' as const, type: 'marine' },
      { team: 'attacker' as const, type: 'sniper' },
      { team: 'attacker' as const, type: 'marine' },
      { team: 'attacker' as const, type: 'marine' },
    ]

    expect(countUnitsByTeamType(units)).toEqual({
      attacker: { marine: 2, sniper: 1 },
      defender: { marine: 1 },
    })
  })

  it('renders JSON with a trailing newline for stable file output', () => {
    const rendered = renderSnapshotJson({
      schemaVersion: 2,
      generatedBy: 'npm run combat:snapshot',
      seed: 24680,
      presets: [],
      tier1Scenarios: [],
      scenarios: [],
    })

    expect(rendered.endsWith('\n')).toBe(true)
    expect(JSON.parse(rendered)).toEqual({
      schemaVersion: 2,
      generatedBy: 'npm run combat:snapshot',
      seed: 24680,
      presets: [],
      tier1Scenarios: [],
      scenarios: [],
    })
  })
})
