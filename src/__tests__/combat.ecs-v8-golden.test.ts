import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import fixture from './fixtures/combat-ecs-v8-golden.json'
import { getSimulatorPreset } from '@/app/simulator2/simulator.presets'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { CURRENT_SIMULATION_REVISION, CURRENT_SIMULATION_VERSION } from '@/domains/combat/combat.version'
import type { UnitRow } from '@/domains/combat/combat.types'

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}

function fingerprintPreset(presetId: string): string {
  const preset = getSimulatorPreset(presetId)
  if (!preset) throw new Error(`Missing simulator preset: ${presetId}`)
  const result = simulateBattle(cloneRows(preset.attackers), cloneRows(preset.defenders), fixture.seed, [])
  const contract = {
    winner: result.winner,
    logs: result.logs,
    initialState: result.initialState,
    survivors: result.survivors,
    terminationReason: result.terminationReason,
    elapsedTicks: result.elapsedTicks,
    simulationVersion: result.simulationVersion,
  }
  return createHash('sha256').update(JSON.stringify(contract)).digest('hex')
}

describe('combat ECS v8 golden replay contract', () => {
  it('matches the current simulation metadata contract', () => {
    expect(fixture.simulationVersion).toBe(CURRENT_SIMULATION_VERSION)
    expect(fixture.simulationRevision).toBe(CURRENT_SIMULATION_REVISION)
  })
  for (const [presetId, expected] of Object.entries(fixture.presets)) {
    it(`matches the checked-in ${presetId} contract`, () => {
      expect(fingerprintPreset(presetId)).toBe(expected)
    }, presetId === 'zerg_rush' ? 30_000 : 10_000)
  }
})
