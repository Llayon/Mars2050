import { SIMULATOR_PRESET_OPTIONS, getSimulatorPreset } from '../src/app/simulator2/simulator.presets'
import { compareCombatEngines } from '../src/domains/combat/combat.shadow'

const failures: string[] = []

for (const { id } of SIMULATOR_PRESET_OPTIONS) {
  const preset = getSimulatorPreset(id)
  if (!preset) {
    failures.push(`${id}:missing-preset`)
    continue
  }
  const comparison = compareCombatEngines(
    preset.attackers,
    preset.defenders,
    12345,
    [],
    [],
    [],
    { maxTicks: id === 'zerg_rush' ? 30 : undefined, trackMetrics: true },
  )
  if (comparison.differences.length > 0) failures.push(`${id}:${comparison.differences.join(',')}`)
  else console.log(`PASS ${id}`)
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  process.exitCode = 1
} else {
  console.log(`ECS shadow matrix passed (${SIMULATOR_PRESET_OPTIONS.length} presets)`)
}
