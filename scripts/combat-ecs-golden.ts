import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { getSimulatorPreset } from '../src/app/simulator2/simulator.presets'
import { simulateBattle } from '../src/domains/combat/combat.engine'
import type { UnitRow } from '../src/domains/combat/combat.types'

const FIXTURE = 'src/__tests__/fixtures/combat-ecs-v8-golden.json'
const seed = 24680

interface GoldenFixture {
  simulationVersion: number
  seed: number
  presets: Record<string, string>
}

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}

function fingerprintPreset(presetId: string): string {
  const preset = getSimulatorPreset(presetId)
  if (!preset) throw new Error(`Missing simulator preset: ${presetId}`)
  const result = simulateBattle(cloneRows(preset.attackers), cloneRows(preset.defenders), seed, [])
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

function readFixture(): GoldenFixture {
  if (!existsSync(FIXTURE)) return { simulationVersion: 8, seed, presets: {} }
  const parsed = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, unknown>
  if ('presets' in parsed) return parsed as unknown as GoldenFixture
  return { simulationVersion: 8, seed, presets: Object.fromEntries(Object.entries(parsed)) }
}

function main(): void {
  const args = process.argv.slice(2)
  const updateIndex = args.indexOf('--update')
  const updateIds = updateIndex >= 0 ? args.slice(updateIndex + 1).filter(arg => !arg.startsWith('--')) : []
  const fixture = readFixture()
  const ids = Object.keys(fixture.presets).sort()
  if (updateIndex >= 0 && updateIds.length === 0) throw new Error('--update requires at least one preset id')
  const names = updateIndex >= 0 ? updateIds : ids
  const drift: string[] = []
  for (const presetId of names) {
    const actual = fingerprintPreset(presetId)
    const expected = fixture.presets[presetId]
    if (expected !== actual) drift.push(`${presetId}: ${expected ?? '<missing>'} -> ${actual}`)
    if (updateIndex >= 0) fixture.presets[presetId] = actual
  }
  if (updateIndex >= 0) {
    fixture.simulationVersion = 8
    fixture.seed = seed
    writeFileSync(FIXTURE, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8')
    console.log(`Updated ${drift.length || updateIds.length} golden preset(s): ${updateIds.join(', ')}`)
    return
  }
  if (drift.length > 0) {
    console.error(drift.join('\n'))
    process.exitCode = 1
    return
  }
  console.log(`Golden replay contract is stable for ${ids.length} preset(s)`)
}

main()
