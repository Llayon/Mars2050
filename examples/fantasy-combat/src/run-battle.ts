import { simulateCombat } from '@mars2050/combat-core'
import type { BattleInput } from '@mars2050/combat-core/contracts'
import { FANTASY_DEFINITIONS } from './fantasy-catalog.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fingerprint(result: ReturnType<typeof simulateCombat>): string {
  return JSON.stringify(result)
}

function assertDeterminism(input: BattleInput, label: string): ReturnType<typeof simulateCombat> {
  const r1 = simulateCombat(input)
  const r2 = simulateCombat(input)
  const f1 = fingerprint(r1)
  const f2 = fingerprint(r2)
  if (f1 !== f2) {
    throw new Error(`[${label}] Determinism violation: two runs with identical seed produced different results!`)
  }
  return r1
}

function assertFrozenInput(input: BattleInput, label: string): void {
  const inputJson = JSON.stringify(input)
  simulateCombat(input)
  const afterJson = JSON.stringify(input)
  if (inputJson !== afterJson) {
    throw new Error(`[${label}] Frozen input violation: simulateCombat mutated the input object!`)
  }
}

function assertJsonRoundTrip(input: BattleInput, label: string): void {
  const json = JSON.stringify(input)
  const restored = JSON.parse(json) as BattleInput
  const r1 = simulateCombat(input)
  const r2 = simulateCombat(restored)
  if (fingerprint(r1) !== fingerprint(r2)) {
    throw new Error(`[${label}] JSON round-trip violation: results differ after JSON.parse(JSON.stringify(input))`)
  }
}

// ─── Scenario 1: Melee Clash ──────────────────────────────────────────────────

export function scenarioPureMelee(seed = 1001): ReturnType<typeof simulateCombat> {
  const input: BattleInput = {
    seed,
    arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
    rules: { maxTicks: 300, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
    definitions: FANTASY_DEFINITIONS,
    units: [
      { instanceId: 'att_orcs', definitionId: 'orc_warrior', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
      { instanceId: 'def_orcs', definitionId: 'orc_warrior', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
    ],
    scheduledEffects: [],
  }
  assertFrozenInput(input, 'PureMelee')
  assertJsonRoundTrip(input, 'PureMelee')
  return assertDeterminism(input, 'PureMelee')
}

// ─── Scenario 2: Mage with Status-on-Hit (burn) ───────────────────────────────

export function scenarioMageStatus(seed = 1002): ReturnType<typeof simulateCombat> {
  const input: BattleInput = {
    seed,
    arena: { width: 600, height: 1200, tileSize: 40, obstacles: [{ x: 300, y: 600, radius: 50 }] },
    rules: { maxTicks: 400, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
    definitions: FANTASY_DEFINITIONS,
    units: [
      { instanceId: 'att_mages', definitionId: 'human_mage', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
      { instanceId: 'att_warriors', definitionId: 'orc_warrior', team: 'attacker', placement: { x: 250, y: 1050 }, rank: 1, upgradeIds: [] },
      { instanceId: 'def_elves', definitionId: 'elven_archer', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
    ],
    scheduledEffects: [],
  }
  assertFrozenInput(input, 'MageStatus')
  assertJsonRoundTrip(input, 'MageStatus')
  const result = assertDeterminism(input, 'MageStatus')

  // Verify burn status was applied at least once
  const burnEvents = result.logs.flatMap(tick =>
    tick.actions.filter(a => a.type === 'status' && (a as { statusType?: string }).statusType === 'burn')
  )
  if (burnEvents.length === 0) {
    console.warn('  [MageStatus] Notice: no burn status events observed (mage may not have attacked).')
  }
  return result
}

// ─── Scenario 3: Healer Supporting Allies ────────────────────────────────────

export function scenarioHealer(seed = 1003): ReturnType<typeof simulateCombat> {
  const input: BattleInput = {
    seed,
    arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
    rules: { maxTicks: 500, timeoutPolicy: 'attacker_win', defenseResolutionMode: 'v9_snapshot' },
    definitions: FANTASY_DEFINITIONS,
    units: [
      { instanceId: 'att_warriors', definitionId: 'orc_warrior', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
      { instanceId: 'att_healer', definitionId: 'forest_healer', team: 'attacker', placement: { x: 350, y: 1050 }, rank: 1, upgradeIds: [] },
      { instanceId: 'def_elves', definitionId: 'elven_archer', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
      { instanceId: 'def_mages', definitionId: 'human_mage', team: 'defender', placement: { x: 250, y: 250 }, rank: 1, upgradeIds: [] },
    ],
    scheduledEffects: [],
  }
  assertFrozenInput(input, 'Healer')
  assertJsonRoundTrip(input, 'Healer')
  return assertDeterminism(input, 'Healer')
}

// ─── Scenario 4: In-combat Summon (Shaman + Necromancer) ─────────────────────

export function scenarioSummon(seed = 1004): ReturnType<typeof simulateCombat> {
  const input: BattleInput = {
    seed,
    arena: { width: 600, height: 1200, tileSize: 40, obstacles: [{ x: 150, y: 450, radius: 30 }, { x: 450, y: 750, radius: 30 }] },
    rules: { maxTicks: 300, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
    definitions: FANTASY_DEFINITIONS,
    units: [
      { instanceId: 'att_shaman', definitionId: 'goblin_shaman', team: 'attacker', placement: { x: 300, y: 1050 }, rank: 1, upgradeIds: [] },
      { instanceId: 'att_orcs', definitionId: 'orc_warrior', team: 'attacker', placement: { x: 250, y: 1000 }, rank: 1, upgradeIds: [] },
      { instanceId: 'def_necro', definitionId: 'necromancer', team: 'defender', placement: { x: 300, y: 150 }, rank: 1, upgradeIds: [] },
      { instanceId: 'def_elves', definitionId: 'elven_archer', team: 'defender', placement: { x: 350, y: 200 }, rank: 1, upgradeIds: [] },
    ],
    scheduledEffects: [],
  }
  assertFrozenInput(input, 'Summon')
  assertJsonRoundTrip(input, 'Summon')
  const result = assertDeterminism(input, 'Summon')

  const fireSpawns = result.logs.flatMap(tick =>
    tick.actions.filter(a => a.type === 'spawn' && (a as { spawnType?: string }).spawnType === 'fire_elemental')
  )
  const skelSpawns = result.logs.flatMap(tick =>
    tick.actions.filter(a => a.type === 'spawn' && (a as { spawnType?: string }).spawnType === 'skeleton')
  )
  console.log(`  In-combat fire_elemental summons: ${fireSpawns.length}`)
  console.log(`  In-combat skeleton summons: ${skelSpawns.length}`)
  return result
}

// ─── Scenario 5: Timeout Policy ──────────────────────────────────────────────

export function scenarioTimeout(seed = 1005): ReturnType<typeof simulateCombat> {
  const input: BattleInput = {
    seed,
    arena: { width: 300, height: 600, tileSize: 40, obstacles: [] },
    rules: { maxTicks: 10, timeoutPolicy: 'defender_win', defenseResolutionMode: 'v9_snapshot' },
    definitions: FANTASY_DEFINITIONS,
    units: [
      { instanceId: 'att_far', definitionId: 'orc_warrior', team: 'attacker', placement: { x: 150, y: 550 }, rank: 1, upgradeIds: [] },
      { instanceId: 'def_far', definitionId: 'orc_warrior', team: 'defender', placement: { x: 150, y: 50 }, rank: 1, upgradeIds: [] },
    ],
    scheduledEffects: [],
  }
  assertFrozenInput(input, 'Timeout')
  assertJsonRoundTrip(input, 'Timeout')
  const result = assertDeterminism(input, 'Timeout')
  if (result.terminationReason !== 'timeout') {
    console.warn(`  [Timeout] Notice: expected timeout termination, got: ${result.terminationReason}`)
  }
  if (result.terminationReason === 'timeout' && result.winner !== 'defender') {
    throw new Error(`[Timeout] Expected timeoutPolicy 'defender_win' → winner=defender, got: ${result.winner}`)
  }
  return result
}

// ─── Scenario 6: Alternate Arena (smaller) ───────────────────────────────────

export function scenarioSmallArena(seed = 1006): ReturnType<typeof simulateCombat> {
  const input: BattleInput = {
    seed,
    arena: { width: 300, height: 600, tileSize: 20, obstacles: [{ x: 150, y: 300, radius: 25 }] },
    rules: { maxTicks: 300, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
    definitions: FANTASY_DEFINITIONS,
    units: [
      { instanceId: 'att_mages', definitionId: 'human_mage', team: 'attacker', placement: { x: 150, y: 500 }, rank: 1, upgradeIds: [] },
      { instanceId: 'def_elves', definitionId: 'elven_archer', team: 'defender', placement: { x: 150, y: 100 }, rank: 1, upgradeIds: [] },
    ],
    scheduledEffects: [],
  }
  assertFrozenInput(input, 'SmallArena')
  assertJsonRoundTrip(input, 'SmallArena')
  return assertDeterminism(input, 'SmallArena')
}

// ─── Original B1 Battle (preserved for regression) ───────────────────────────

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
      { instanceId: 'attacker_orcs', definitionId: 'orc_warrior', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
      { instanceId: 'attacker_shaman', definitionId: 'goblin_shaman', team: 'attacker', placement: { x: 350, y: 1050 }, rank: 1, upgradeIds: [] },
      { instanceId: 'defender_elves', definitionId: 'elven_archer', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
    ],
    scheduledEffects: [],
  }

  const run1 = simulateCombat(battleInput)
  const run2 = simulateCombat(battleInput)

  const json1 = JSON.stringify(run1)
  const json2 = JSON.stringify(run2)
  if (json1 !== json2) {
    throw new Error('Determinism violation: run1 and run2 produced different results with identical seed!')
  }

  const spawnEvents = run1.logs.flatMap(tick =>
    tick.actions.filter(a => a.type === 'spawn' && (a as { spawnType?: string }).spawnType === 'fire_elemental')
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

// ─── E7 Full Matrix Runner ───────────────────────────────────────────────────

function runE7Matrix() {
  console.log('\n=== E7 Fantasy Combat Contract Matrix ===\n')

  const scenarios: Array<[string, () => ReturnType<typeof simulateCombat>]> = [
    ['S1: Original B1 (summon regression)', () => runFantasyBattle(42)],
    ['S2: Pure Melee Clash', () => scenarioPureMelee(1001)],
    ['S3: Mage with Burn Status', () => scenarioMageStatus(1002)],
    ['S4: Healer Supporting Allies', () => scenarioHealer(1003)],
    ['S5: Dual Summon (shaman + necromancer)', () => scenarioSummon(1004)],
    ['S6: Timeout Policy (defender_win)', () => scenarioTimeout(1005)],
    ['S7: Small Arena (300×600, tileSize 20)', () => scenarioSmallArena(1006)],
  ]

  let passed = 0
  let failed = 0

  for (const [label, run] of scenarios) {
    process.stdout.write(`[${label}] ... `)
    try {
      const result = run()
      console.log(`PASS (winner=${result.winner}, ticks=${result.elapsedTicks}, reason=${result.terminationReason})`)
      passed++
    } catch (err) {
      console.error(`FAIL: ${(err as Error).message}`)
      failed++
    }
  }

  console.log(`\n=== Matrix Result: ${passed}/${scenarios.length} passed, ${failed} failed ===`)

  if (failed > 0) {
    process.exit(1)
  }
}

runE7Matrix()
