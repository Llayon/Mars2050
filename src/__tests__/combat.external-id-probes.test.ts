import { describe, expect, it } from 'vitest'
import type { CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import type { Team, UnitRow } from '@/domains/combat/combat.types'
import {
  applyExternalIdProbe,
  canonicalOrderChanged,
  canonicalSemanticOrder,
  compiledExternalIds,
  EXTERNAL_ID_RENAME_SCHEMES,
  rawIdStringsChanged,
  type ExternalIdProbeTransform,
} from './helpers/combat-external-id-probes'

describe('combat external-ID probes', () => {
  const scenario = syntheticScenario()

  it('preserves compiled semantic order for every rank-preserving rename', () => {
    const baseline = applyExternalIdProbe(scenario, 'baseline')
    for (const scheme of EXTERNAL_ID_RENAME_SCHEMES) {
      const renamed = applyExternalIdProbe(scenario, scheme)
      expect(canonicalOrderChanged(baseline, renamed)).toBe(false)
      expect(rawIdStringsChanged(baseline, renamed)).toBe(true)
      expect(canonicalSemanticOrder(renamed)).toEqual(canonicalSemanticOrder(baseline))
    }
  })

  it('proves rank permutation changes actual compiled lexical order', () => {
    const baseline = applyExternalIdProbe(scenario, 'baseline')
    const permuted = applyExternalIdProbe(scenario, 'rank_permuted')

    expect(canonicalOrderChanged(baseline, permuted)).toBe(true)
    expect(rawIdStringsChanged(baseline, permuted)).toBe(true)
    expect(canonicalSemanticOrder(permuted)).not.toEqual(canonicalSemanticOrder(baseline))
  })

  it('keeps mirrored rank-preserving schemes separate from the legacy mirror contract', () => {
    const preserve = applyExternalIdProbe(scenario, 'full_mirrored_preserve_ids')
    for (const suffix of ['a', 'b', 'c'] as const) {
      const renamed = applyExternalIdProbe(scenario, `full_mirrored_rank_preserving_${suffix}`)
      expect(canonicalOrderChanged(preserve, renamed)).toBe(false)
      expect(rawIdStringsChanged(preserve, renamed)).toBe(true)
      expect(compiledExternalIds(renamed)).toHaveLength(compiledExternalIds(preserve).length)
    }
    const legacy = applyExternalIdProbe(scenario, 'full_mirrored_legacy')
    expect(compiledExternalIds(legacy)).toHaveLength(compiledExternalIds(preserve).length)
  })

  it('retains reversible member mappings and deterministic transforms', () => {
    const transforms: ExternalIdProbeTransform[] = [
      'baseline', ...EXTERNAL_ID_RENAME_SCHEMES, 'rank_permuted',
      'full_mirrored_preserve_ids', 'full_mirrored_rank_preserving_a',
      'full_mirrored_rank_preserving_b', 'full_mirrored_rank_preserving_c', 'full_mirrored_legacy',
    ]
    for (const transform of transforms) {
      const first = applyExternalIdProbe(scenario, transform)
      const second = applyExternalIdProbe(scenario, transform)
      expect(first).toEqual(second)
      expect(first.semanticByExternalId.size).toBe(18)
      expect(new Set(compiledExternalIds(first)).size).toBe(18)
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
    upgrade_path: ['probe-upgrade'],
    grid_x: String(x),
    grid_y: String(y),
  })
  return {
    id: 'external-id-probe-synthetic',
    name: 'External ID probe synthetic',
    attackers: [row('a-zeta', 'attacker', 'marine', 100, 200), row('a-single', 'attacker', 'light_walker', 200, 200)],
    defenders: [row('d-alpha', 'defender', 'marine', 100, 800), row('d-single', 'defender', 'light_walker', 200, 800)],
  }
}
