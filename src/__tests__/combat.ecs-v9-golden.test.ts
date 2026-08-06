import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import fixture from './fixtures/combat-ecs-v9-golden.json'
import { getSimulatorPreset } from '@/app/simulator2/simulator.presets'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { CURRENT_SIMULATION_REVISION, CURRENT_SIMULATION_VERSION } from '@/domains/combat/combat.version'
import type { UnitRow } from '@/domains/combat/combat.types'

function fingerprintPreset(presetId: string): string {
  const preset = getSimulatorPreset(presetId)
  if (!preset) throw new Error(`Missing simulator preset: ${presetId}`)
  const clone = (rows: UnitRow[]) => rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
  const result = simulateBattle(clone(preset.attackers), clone(preset.defenders), fixture.seed, [], [], [], { defenseResolutionMode: 'v9_snapshot' })
  return createHash('sha256').update(JSON.stringify({ winner: result.winner, logs: result.logs, initialState: result.initialState, survivors: result.survivors, terminationReason: result.terminationReason, elapsedTicks: result.elapsedTicks, simulationVersion: result.simulationVersion })).digest('hex')
}

describe('combat ECS v9 defense snapshot golden replay contract', () => {
  it('publishes the V9 metadata contract', () => {
    expect(fixture.simulationVersion).toBe(CURRENT_SIMULATION_VERSION)
    expect(fixture.simulationRevision).toBe(CURRENT_SIMULATION_REVISION)
  })
  for (const presetId of Object.keys(fixture.presets)) it(`matches ${presetId}`, () => expect(fingerprintPreset(presetId)).toBe(fixture.presets[presetId as keyof typeof fixture.presets]), presetId === 'zerg_rush' ? 30_000 : 10_000)
})
