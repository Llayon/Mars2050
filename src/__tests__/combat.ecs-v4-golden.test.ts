import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { getSimulatorPreset } from '@/app/simulator2/simulator.presets'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { UnitRow } from '@/domains/combat/combat.types'
import goldenHashes from './fixtures/combat-ecs-v4-golden.json'

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}

function fingerprintPreset(presetId: string): string {
  const preset = getSimulatorPreset(presetId)
  if (!preset) throw new Error(`Missing simulator preset: ${presetId}`)
  const result = simulateBattle(
    cloneRows(preset.attackers),
    cloneRows(preset.defenders),
    24680,
    [],
  )
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

describe('combat ECS v4 golden replay contract', () => {
  for (const [presetId, expectedHash] of Object.entries(goldenHashes)) {
    it(`keeps ${presetId} deterministic`, () => {
      expect(fingerprintPreset(presetId)).toBe(expectedHash)
    }, presetId === 'zerg_rush' ? 30_000 : 5_000)
  }
})
