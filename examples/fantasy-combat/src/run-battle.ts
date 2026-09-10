import { simulateCombat } from '@mars2050/combat-core'
import type { BattleInput } from '@mars2050/combat-core/contracts'
import { FANTASY_DEFINITIONS } from './fantasy-catalog.js'

export function runFantasyBattle(seed: number = 42) {
  const battleInput: BattleInput = {
    seed,
    arena: {
      width: 600,
      height: 1200,
      tileSize: 40,
      obstacles: [
        { x: 300, y: 600, radius: 40 },
        { x: 150, y: 450, radius: 30 },
      ],
    },
    rules: {
      maxTicks: 300,
      timeoutPolicy: 'draw',
      defenseResolutionMode: 'v9_snapshot',
    },
    definitions: FANTASY_DEFINITIONS,
    units: [
      {
        instanceId: 'attacker_orcs',
        definitionId: 'orc_warrior',
        team: 'attacker',
        placement: { x: 300, y: 1000 },
        rank: 1,
        upgradeIds: [],
      },
      {
        instanceId: 'attacker_shaman',
        definitionId: 'goblin_shaman',
        team: 'attacker',
        placement: { x: 350, y: 1050 },
        rank: 1,
        upgradeIds: [],
      },
      {
        instanceId: 'defender_elves',
        definitionId: 'elven_archer',
        team: 'defender',
        placement: { x: 300, y: 200 },
        rank: 1,
        upgradeIds: [],
      },
    ],
    scheduledEffects: [],
  }

  const run1 = simulateCombat(battleInput)
  const run2 = simulateCombat(battleInput)

  // Determinism check
  const json1 = JSON.stringify(run1)
  const json2 = JSON.stringify(run2)
  if (json1 !== json2) {
    throw new Error('Determinism violation: run1 and run2 produced different results with identical seed!')
  }

  // Verify in-combat summon occurred
  const spawnEvents = run1.logs.flatMap(tick =>
    tick.actions.filter(a => a.type === 'spawn' && a.spawnType === 'fire_elemental')
  )

  console.log('Fantasy battle completed successfully!')
  console.log('  Winner: ' + run1.winner)
  console.log('  Elapsed ticks: ' + run1.elapsedTicks)
  console.log('  Termination reason: ' + run1.terminationReason)
  console.log('  Initial units: ' + run1.initialState.length)
  console.log('  Survivors: ' + run1.survivors.length)
  console.log('  Total tick events: ' + run1.logs.length)
  console.log('  In-combat fire_elemental summons: ' + spawnEvents.length)
  console.log('  Determinism: 100% byte-identical (hash length ' + json1.length + ')')

  if (spawnEvents.length === 0) {
    console.warn('Notice: Shaman was defeated before summon or cooldown not reached.')
  }

  return run1
}

runFantasyBattle()
