import { describe, expect, it } from 'vitest'
import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import type { Team, UnitRow } from '@/domains/combat/combat.types'
import { FIELD_HEIGHT } from '@/domains/combat/combat.utils'
import { mirrorTier1Rows } from './helpers/combat-tier1-matchup'
import {
  applyOrientationProbe,
  type OrientationProbeTransform,
} from './helpers/combat-orientation-probes'

describe('combat orientation probes', () => {
  const scenario = syntheticScenario()

  it('keeps baseline identity and changes only input order for the reverse probe', () => {
    const baseline = applyOrientationProbe(scenario, 'baseline')
    const reversed = applyOrientationProbe(scenario, 'input_order_reversed')

    expect(baseline.attackers).toEqual(scenario.attackers)
    expect(baseline.defenders).toEqual(scenario.defenders)
    expect(reversed.attackers.map(row => row.id)).toEqual(['a-single', 'a-marine'])
    expect(reversed.defenders.map(row => row.id)).toEqual(['d-single', 'd-marine'])
    expect(reversed.attackers.slice().reverse()).toEqual(baseline.attackers)
    expect(reversed.defenders.slice().reverse()).toEqual(baseline.defenders)
  })

  it('permutes lexical IDs without changing rows or semantic member identities', () => {
    const baseline = applyOrientationProbe(scenario, 'baseline')
    const permuted = applyOrientationProbe(scenario, 'external_id_permuted')

    expect(permuted.attackers.map(row => row.grid_x)).toEqual(baseline.attackers.map(row => row.grid_x))
    expect(permuted.defenders.map(row => row.grid_y)).toEqual(baseline.defenders.map(row => row.grid_y))
    expect(permuted.attackers.map(row => row.id)).not.toEqual(baseline.attackers.map(row => row.id))
    expect(new Set(permuted.semanticByExternalId.keys()).size).toBe(18)

    const marineMembers = [...permuted.semanticByExternalId.values()]
      .filter(identity => identity.originalRowId === 'a-marine')
    expect(marineMembers.map(identity => identity.memberOrdinal)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('reflects only squad centers and preserves the declared teams and IDs', () => {
    const baseline = applyOrientationProbe(scenario, 'baseline')
    const reflected = applyOrientationProbe(scenario, 'center_y_reflected')

    expect(reflected.attackers.map(row => row.id)).toEqual(baseline.attackers.map(row => row.id))
    expect(reflected.attackers.map(row => row.grid_x)).toEqual(baseline.attackers.map(row => row.grid_x))
    expect(reflected.attackers.map(row => row.grid_y)).toEqual(
      baseline.attackers.map(row => String(FIELD_HEIGHT - Number(row.grid_y))),
    )
    expect(reflected.attackers.map(row => row.colony_id)).toEqual(['attacker', 'attacker'])
  })

  it('swaps semantic sides while preserving geometry and external IDs', () => {
    const swapped = applyOrientationProbe(scenario, 'team_semantics_swapped')

    expect(swapped.roleTeam).toBe('defender')
    expect(swapped.attackers.map(row => row.id)).toEqual(['d-marine', 'd-single'])
    expect(swapped.defenders.map(row => row.id)).toEqual(['a-marine', 'a-single'])
    expect(swapped.attackers.every(row => row.colony_id === 'attacker')).toBe(true)
    expect(swapped.defenders.every(row => row.colony_id === 'defender')).toBe(true)
    expect(swapped.attackers.map(row => row.grid_y)).toEqual(['800', '800'])
  })

  it('preserves IDs in the complete mirror and validates reversible semantics', () => {
    const mirrored = applyOrientationProbe(scenario, 'full_mirrored_preserve_ids')

    expect(mirrored.roleTeam).toBe('defender')
    expect(mirrored.attackers.map(row => row.id)).toEqual(['d-marine', 'd-single'])
    expect(mirrored.attackers.map(row => row.grid_y)).toEqual(['400', '400'])
    expect(mirrored.defenders.map(row => row.id)).toEqual(['a-marine', 'a-single'])
    expect(mirrored.semanticByExternalId.get('d-marine_7')).toMatchObject({
      originalRole: 'defender',
      originalRowId: 'd-marine',
      memberOrdinal: 7,
    })
  })

  it('matches the existing PR #6 legacy mirror contract exactly', () => {
    const tier1 = TIER1_BALANCE_SCENARIOS.find(item => item.id === 'tier1_grenadier_vs_clump')
    if (!tier1) throw new Error('Expected Tier 1 grenadier scenario')
    const mirrored = applyOrientationProbe(tier1, 'full_mirrored_legacy')

    expect(mirrored.attackers).toEqual(mirrorTier1Rows(tier1.defenders, 'attacker'))
    expect(mirrored.defenders).toEqual(mirrorTier1Rows(tier1.attackers, 'defender'))
  })

  it('is deterministic when applying every transform twice', () => {
    const transforms: OrientationProbeTransform[] = [
      'baseline',
      'input_order_reversed',
      'external_id_permuted',
      'center_y_reflected',
      'team_semantics_swapped',
      'full_mirrored_preserve_ids',
      'full_mirrored_legacy',
    ]

    for (const transform of transforms) {
      expect(applyOrientationProbe(scenario, transform)).toEqual(applyOrientationProbe(scenario, transform))
    }
  })
})

function syntheticScenario(): CombatBalanceScenario {
  const row = (id: string, team: Team, unitType: UnitRow['unit_type'], x: number, y: number): UnitRow => ({
    id,
    colony_id: team,
    unit_type: unitType,
    hp_current: 100,
    tier: 1,
    upgrade_path: ['sample-upgrade'],
    grid_x: String(x),
    grid_y: String(y),
  })

  return {
    id: 'orientation-probe-synthetic',
    name: 'Orientation probe synthetic',
    attackers: [
      row('a-marine', 'attacker', 'marine', 100, 200),
      row('a-single', 'attacker', 'light_walker', 200, 200),
    ],
    defenders: [
      row('d-marine', 'defender', 'marine', 100, 800),
      row('d-single', 'defender', 'light_walker', 200, 800),
    ],
  }
}
