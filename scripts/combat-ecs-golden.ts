import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { getSimulatorPreset } from '../src/app/simulator2/simulator.presets'
import { simulateBattle } from '../src/domains/combat/combat.engine'
import { CURRENT_SIMULATION_REVISION, CURRENT_SIMULATION_VERSION, V8_SIMULATION_REVISION, V8_SIMULATION_VERSION } from '../src/domains/combat/combat.version'
import type { UnitRow } from '../src/domains/combat/combat.types'

const V9_MODE = process.argv.includes('--v9')
const FIXTURE = V9_MODE ? 'src/__tests__/fixtures/combat-ecs-v9-golden.json' : 'src/__tests__/fixtures/combat-ecs-v8-golden.json'
const SIMULATION_VERSION = V9_MODE ? CURRENT_SIMULATION_VERSION : V8_SIMULATION_VERSION
const SIMULATION_REVISION = V9_MODE ? CURRENT_SIMULATION_REVISION : V8_SIMULATION_REVISION
const seed = 24680

interface GoldenFixture {
  simulationVersion: number
  simulationRevision: string
  seed: number
  presets: Record<string, string>
}

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}

function fingerprintPreset(presetId: string): string {
  const preset = getSimulatorPreset(presetId)
  if (!preset) throw new Error(`Missing simulator preset: ${presetId}`)
  const result = simulateBattle(cloneRows(preset.attackers), cloneRows(preset.defenders), seed, [], [], [], { defenseResolutionMode: V9_MODE ? 'v9_snapshot' : 'v8_sequential' })
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
  if (!existsSync(FIXTURE)) return { simulationVersion: SIMULATION_VERSION, simulationRevision: SIMULATION_REVISION, seed, presets: {} }
  const parsed = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, unknown>
  if ('presets' in parsed) {
    return {
      simulationVersion: typeof parsed.simulationVersion === 'number' ? parsed.simulationVersion : SIMULATION_VERSION,
      simulationRevision: typeof parsed.simulationRevision === 'string' ? parsed.simulationRevision : SIMULATION_REVISION,
      seed: typeof parsed.seed === 'number' ? parsed.seed : seed,
      presets: parsed.presets as Record<string, string>,
    }
  }
  return { simulationVersion: SIMULATION_VERSION, simulationRevision: SIMULATION_REVISION, seed, presets: Object.fromEntries(Object.entries(parsed)) }
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
  if (updateIndex < 0 && fixture.simulationVersion !== SIMULATION_VERSION) drift.push(`fixture simulationVersion ${fixture.simulationVersion} != ${SIMULATION_VERSION}`)
  if (updateIndex < 0 && fixture.simulationRevision !== SIMULATION_REVISION) drift.push(`fixture simulationRevision ${fixture.simulationRevision} != ${SIMULATION_REVISION}`)
  for (const presetId of names) {
    const actual = fingerprintPreset(presetId)
    const expected = fixture.presets[presetId]
    if (expected !== actual) drift.push(`${presetId}: ${expected ?? '<missing>'} -> ${actual}`)
    if (updateIndex >= 0) fixture.presets[presetId] = actual
  }
  if (updateIndex >= 0) {
    fixture.simulationVersion = SIMULATION_VERSION
    fixture.simulationRevision = SIMULATION_REVISION
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
