import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.types'
import { renderSnapshotJson } from '../../scripts/combat-snapshot'
import { countActionsByType, countUnitsByTeamType, countValueByTeamType, summarizeRoleSignals, totalTeamValues } from '../../scripts/combat-snapshot-analysis'

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

  it('normalizes expanded squad members back to hire value', () => {
    const units = [
      ...Array.from({ length: 8 }, () => ({ team: 'attacker' as const, type: 'marine' })),
      { team: 'defender' as const, type: 'aa_turret' },
    ]
    const values = countValueByTeamType(units)

    expect(values).toEqual({
      attacker: { marine: 100 },
      defender: { aa_turret: 200 },
    })
    expect(totalTeamValues(values)).toEqual({ attacker: 100, defender: 200 })
  })

  it('summarizes role signals without noisy zero entries', () => {
    const actions: BattleAction[] = [
      { unitId: 'a', type: 'status_apply', statusType: 'burn' },
      { unitId: 'a', type: 'status_apply', statusType: 'burn' },
      { unitId: 'b', type: 'charge_damage' },
      { unitId: 'c', type: 'attack' },
    ]

    expect(summarizeRoleSignals(actions)).toEqual({
      actions: { charge_damage: 1, status_apply: 2 },
      statusApplications: { burn: 2 },
    })
  })

  it('renders JSON with a trailing newline for stable file output', () => {
    const rendered = renderSnapshotJson({
      schemaVersion: 4,
      generatedBy: 'npm run combat:snapshot',
      seed: 24680,
      presets: [],
      tier1Scenarios: [],
      scenarios: [],
    })

    expect(rendered.endsWith('\n')).toBe(true)
    expect(JSON.parse(rendered)).toEqual({
      schemaVersion: 4,
      generatedBy: 'npm run combat:snapshot',
      seed: 24680,
      presets: [],
      tier1Scenarios: [],
      scenarios: [],
    })
  })
})
