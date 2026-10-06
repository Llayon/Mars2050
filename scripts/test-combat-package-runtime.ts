import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const TSCBIN = process.platform === 'win32' ? 'tsc.cmd' : 'tsc'

function run(command: string, cwd: string, extraEnv: Record<string, string> = {}): string {
  const env = { ...process.env, NODE_PATH: '', ...extraEnv }
  return execSync(command, { cwd, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
}

function main(): void {
  const rootDir = process.cwd()
  const stageDir = join(tmpdir(), `combat-core-runtime-${Date.now()}`)
  mkdirSync(stageDir, { recursive: true })

  try {
    console.log('[1/4] Building @mars2050/combat-core...')
    run(`${NPM} --workspace=@mars2050/combat-core run build`, rootDir)

    console.log('[2/4] Packaging tarball into isolated tmpdir...')
    const packJson = run(`${NPM} pack --workspace=@mars2050/combat-core --json --pack-destination="${stageDir}"`, rootDir)
    const packMeta = JSON.parse(packJson)[0]
    const tarballPath = join(stageDir, packMeta.filename)
    if (!existsSync(tarballPath)) throw new Error(`Tarball not found at ${tarballPath}`)
    const tarballHash = createHash('sha256').update(readFileSync(tarballPath)).digest('hex')
    console.log(`Tarball created: ${packMeta.filename} (sha256: ${tarballHash})`)

    console.log('[3/4] Setting up standalone consumer outside workspace...')
    const consumerDir = join(stageDir, 'consumer')
    mkdirSync(consumerDir, { recursive: true })
    writeFileSync(join(consumerDir, 'package.json'), JSON.stringify({
      name: 'runtime-consumer', version: '1.0.0', type: 'module',
      dependencies: { zod: '^4.4.2' },
      devDependencies: { typescript: '^5.0.0', '@types/node': '^20.0.0' },
    }, null, 2), 'utf8')
    run(`${NPM} install "${tarballPath}"`, consumerDir)
    writeFileSync(join(consumerDir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
        lib: ['ES2022', 'DOM'], strict: true, outDir: './dist', skipLibCheck: true,
      },
      include: ['./consumer.ts'],
    }, null, 2), 'utf8')
    writeFileSync(join(consumerDir, 'consumer.ts'), CONSUMER_CODE, 'utf8')

    console.log('[4/4] Compiling and running archive battle consumer...')
    const localTsc = join(consumerDir, 'node_modules', '.bin', TSCBIN)
    run(existsSync(localTsc) ? `"${localTsc}" -p tsconfig.json` : `${NPM} -p typescript tsc -p tsconfig.json`, consumerDir)
    console.log(run('node dist/consumer.js', consumerDir).trim())
    console.log(`\nRuntime archive smoke PASSED. (Archive SHA256: ${tarballHash})`)
  } finally {
    try {
      rmSync(stageDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup error on Windows if busy
    }
  }
}

const CONSUMER_CODE = `
import { createRequire } from 'node:module'
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { simulateCombat } from '@mars2050/combat-core'
import {
  serializeCombatUnitSnapshot,
  deserializeCombatUnitSnapshot,
  encodeLegacyReplayJson,
  decodeLegacyReplayJson,
} from '@mars2050/combat-core/replay'
import type { BattleInput, UnitDefinition } from '@mars2050/combat-core/contracts'


// 0. Verify package resolution is strictly from this consumer's isolated node_modules
if (process.env.NODE_PATH) {
  throw new Error(\`Isolation violation: NODE_PATH is not empty: \${process.env.NODE_PATH}\`)
}
const require = createRequire(import.meta.url)
const resolvedPkg = require.resolve('@mars2050/combat-core')
const consumerDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const expectedNodeModules = resolve(consumerDir, 'node_modules', '@mars2050', 'combat-core')
const normResolved = resolve(resolvedPkg)

function isPathInside(childPath: string, parentDir: string): boolean {
  const normChild = resolve(childPath)
  const normParent = resolve(parentDir)
  const rel = relative(normParent, normChild)
  return !rel.startsWith('..') && !isAbsolute(rel) && rel !== '' && normChild.startsWith(normParent + sep)
}

// 0a. Negative control: verify containment check explicitly rejects sibling directory with matching prefix
const siblingShadowPkg = resolve(consumerDir, 'node_modules', '@mars2050', 'combat-core-shadow', 'dist', 'index.js')
if (isPathInside(siblingShadowPkg, expectedNodeModules)) {
  throw new Error(\`Isolation containment flaw: sibling directory \${siblingShadowPkg} was falsely accepted as inside \${expectedNodeModules}\`)
}

// 0b. Verify actual resolved package is strictly inside expected package directory
if (!isPathInside(normResolved, expectedNodeModules)) {
  throw new Error(\`Module resolution leak: expected within \${expectedNodeModules}, but resolved to \${normResolved}\`)
}
console.log(\`[consumer] Package resolved correctly from isolated node_modules: \${normResolved}\`)

function fp(v: unknown): string { return JSON.stringify(v) }

function def(id: string, over: Partial<UnitDefinition['baseStats']> = {}): UnitDefinition {
  return {
    id, name: id,
    baseStats: { hp: 500, attack: 10, defense: 2, speed: 4, range: 2, attackType: 'single', actionCooldownMax: 10, turnSpeed: 5, size: 'M', combatTags: [], ...over },
    squadSize: 1, squadSpacing: 20, formation: 'grid',
  }
}

// 1. Real melee battle with explicit positions
const knight = def('knight')
const brute = def('brute', { hp: 600, attack: 12 })
const melee: BattleInput = {
  seed: 4242,
  arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
  rules: { maxTicks: 300, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
  definitions: { knight, brute },
  units: [
    { instanceId: 'k1', definitionId: 'knight', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
    { instanceId: 'b1', definitionId: 'brute', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
  ],
  scheduledEffects: [],
}
const before = fp(melee)
const m1 = simulateCombat(melee)
if (fp(melee) !== before) throw new Error('frozen-input violation: melee input mutated')
const m2 = simulateCombat(JSON.parse(before) as BattleInput)
if (fp(m1) !== fp(m2)) throw new Error('determinism/round-trip violation in melee battle')
const attacks = m1.logs.flatMap(t => t.actions).filter(a => a.type === 'attack').length
const damage = m1.logs.flatMap(t => t.actions).filter(a => a.type === 'damage').length
if (attacks === 0 || damage === 0) throw new Error(\`melee battle dealt no damage (attacks=\${attacks} damage=\${damage})\`)
console.log(\`melee: winner=\${m1.winner} ticks=\${m1.elapsedTicks} attacks=\${attacks} damageEvents=\${damage}\`)

// 2. In-combat summon with owner/source attribution
const shaman = def('shaman', { hp: 200, attack: 0, range: 4, attackType: 'spawn', spawnType: 'imp', spawnCap: 2, actionCooldownMax: 20, combatTags: ['summoner'] })
const imp = def('imp', { hp: 500, attack: 5, combatTags: ['summoned'] })
const guard = def('guard', { hp: 400, attack: 8 })
const summon: BattleInput = {
  seed: 4343,
  arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
  rules: { maxTicks: 300, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
  definitions: { shaman, imp, guard },
  units: [
    { instanceId: 'shaman', definitionId: 'shaman', team: 'attacker', placement: { x: 300, y: 1050 }, rank: 1, upgradeIds: [] },
    { instanceId: 'g1', definitionId: 'guard', team: 'attacker', placement: { x: 250, y: 1000 }, rank: 1, upgradeIds: [] },
    { instanceId: 'd1', definitionId: 'guard', team: 'defender', placement: { x: 300, y: 150 }, rank: 1, upgradeIds: [] },
  ],
  scheduledEffects: [],
}
const s1 = simulateCombat(summon)
const s2 = simulateCombat(JSON.parse(fp(summon)) as BattleInput)
if (fp(s1) !== fp(s2)) throw new Error('determinism violation in summon battle')
const spawns = s1.logs.flatMap(t => t.actions).filter(a => a.type === 'spawn' && (a as { spawnType?: string }).spawnType === 'imp')
if (spawns.length === 0) throw new Error('in-combat summon produced no imp spawns')
function assertSpawnEvent(sa: { unitId?: string; sourceId?: string; targetId?: string; spawnTeam?: string; spawnType?: string }): void {
  if (sa.unitId !== 'shaman') {
    throw new Error(\`spawn event attributed to unexpected summoner unitId: \${sa.unitId} (expected shaman)\`)
  }
  if (sa.sourceId !== 'shaman') {
    throw new Error(\`spawn event attributed to unexpected summoner sourceId: \${sa.sourceId} (expected shaman)\`)
  }
  if (sa.spawnTeam !== 'attacker') {
    throw new Error(\`summon team attribution wrong: \${sa.spawnTeam} (expected attacker)\`)
  }
  if (!sa.targetId) {
    throw new Error('spawn event missing targetId of created creature')
  }
}

// Targeted negative controls for assertSpawnEvent: independent mutation of unitId and sourceId must each throw
let rejectedWrongUnit = false
try {
  assertSpawnEvent({ unitId: 'wrong-unit', sourceId: 'shaman', targetId: 'imp_1', spawnTeam: 'attacker' })
} catch {
  rejectedWrongUnit = true
}
if (!rejectedWrongUnit) throw new Error('assertSpawnEvent failed to reject mutated wrong unitId')

let rejectedWrongSource = false
try {
  assertSpawnEvent({ unitId: 'shaman', sourceId: 'wrong-source', targetId: 'imp_1', spawnTeam: 'attacker' })
} catch {
  rejectedWrongSource = true
}
if (!rejectedWrongSource) throw new Error('assertSpawnEvent failed to reject mutated wrong sourceId')

const spawnedIds = new Set<string>()
for (const a of spawns) {
  const sa = a as { unitId?: string; sourceId?: string; targetId?: string; spawnTeam?: string; spawnType?: string }
  assertSpawnEvent(sa)
  spawnedIds.add(sa.targetId!)
}

const spawnedCreatures = s1.survivors.filter(u => spawnedIds.has(u.id))
if (spawnedCreatures.length !== spawns.length) {
  throw new Error(\`mismatch between spawn events (\${spawns.length}) and created surviving creatures (\${spawnedCreatures.length})\`)
}
for (const creature of spawnedCreatures) {
  if (creature.summonOwnerId !== 'shaman') {
    throw new Error(\`spawned creature \${creature.id} has incorrect summonOwnerId: \${creature.summonOwnerId} (expected shaman)\`)
  }
}

for (const initial of s1.survivors.filter(u => !spawnedIds.has(u.id))) {
  if (initial.summonOwnerId !== undefined) {
    throw new Error(\`initial non-summoned unit \${initial.id} unexpectedly carries summonOwnerId: \${initial.summonOwnerId}\`)
  }
}
console.log(\`summon: impSpawns=\${spawns.length} attributedSurvivors=\${spawnedCreatures.length}\`)

// 3. Burn with real subsequent periodic damage
const pyromancer = def('pyromancer', { hp: 300, attack: 25, speed: 4, range: 6, combatTags: ['magic'], statusOnHit: [{ type: 'burn', duration: 25, value: 8 }] })
const plainMage = def('plainMage', { hp: 300, attack: 25, speed: 4, range: 6, combatTags: ['magic'] })
const golem = def('golem', { hp: 3000, defense: 0, speed: 0 })
const burnBattleInput = (attackerDef: string): BattleInput => ({
  seed: 4444,
  arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
  rules: { maxTicks: 250, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
  definitions: { pyromancer, plainMage, golem },
  units: [
    { instanceId: 'att', definitionId: attackerDef, team: 'attacker', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
    { instanceId: 'def', definitionId: 'golem', team: 'defender', placement: { x: 300, y: 700 }, rank: 1, upgradeIds: [] },
  ],
  scheduledEffects: [],
})
const burnRes = simulateCombat(burnBattleInput('pyromancer'))
const controlRes = simulateCombat(burnBattleInput('plainMage'))
const burnApplies = burnRes.logs.flatMap(t => t.actions).filter(a => a.type === 'status_apply' && (a as { statusType?: string }).statusType === 'burn')
const burnTicks = burnRes.logs.flatMap(t => t.actions).filter(a => a.type === 'status_tick' && (a as { statusType?: string }).statusType === 'burn')
const burnDamages = burnRes.logs.flatMap(t => t.actions).filter(a => a.type === 'damage' && (a as { statusType?: string }).statusType === 'burn')
if (burnApplies.length === 0) throw new Error('burn test: expected status_apply events, observed none')
if (burnTicks.length === 0) throw new Error('burn test: expected status_tick events, observed none')
if (burnDamages.length === 0) throw new Error('burn test: expected damage events with statusType burn, observed none')
const totalBurnDmg = burnDamages.reduce((sum, a) => sum + ((a as { damage?: number }).damage ?? 0), 0)
if (totalBurnDmg <= 0) throw new Error('burn test: expected positive periodic damage, observed none')
const burnDefHpLoss = 3000 - (burnRes.survivors.find(u => u.id === 'def')?.hp ?? 0)
const controlDefHpLoss = 3000 - (controlRes.survivors.find(u => u.id === 'def')?.hp ?? 0)
if (burnDefHpLoss <= controlDefHpLoss) throw new Error('burn test: defender HP loss with burn must exceed control')
const controlBurnEvents = controlRes.logs.flatMap(t => t.actions).filter(a => (a as { statusType?: string }).statusType === 'burn')
if (controlBurnEvents.length !== 0) throw new Error('burn test: control battle contained unexpected burn events')
console.log(\`burn: applies=\${burnApplies.length} ticks=\${burnTicks.length} burnDamage=\${totalBurnDmg} hpLossDiff=\${burnDefHpLoss - controlDefHpLoss}\`)

// 4. healTargetTags: heals allowed target tags, never forbidden tags, respects maxHp
const cleric = def('cleric', { hp: 300, attack: 20, speed: 4, range: 4, attackType: 'heal', healTargetTags: ['organic'], combatTags: ['healer'] })
const allyOrg = def('ally_org', { hp: 120, combatTags: ['organic'] })
const allyMech = def('ally_mech', { hp: 120, combatTags: ['mechanical'] })
const dummyFoe = def('dummy_foe', { hp: 200, attack: 1, speed: 0 })
const healInput: BattleInput = {
  seed: 4545,
  arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
  rules: { maxTicks: 250, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
  definitions: { cleric, ally_org: allyOrg, ally_mech: allyMech, dummy_foe: dummyFoe },
  units: [
    { instanceId: 'cleric', definitionId: 'cleric', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
    { instanceId: 'org', definitionId: 'ally_org', team: 'attacker', placement: { x: 300, y: 950 }, rank: 1, upgradeIds: [], currentHp: 30 },
    { instanceId: 'mech', definitionId: 'ally_mech', team: 'attacker', placement: { x: 350, y: 1000 }, rank: 1, upgradeIds: [], currentHp: 30 },
    { instanceId: 'foe', definitionId: 'dummy_foe', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
  ],
  scheduledEffects: [],
}
const healRes = simulateCombat(healInput)
const controlHealRes = simulateCombat({
  ...healInput,
  units: healInput.units.filter(u => u.instanceId !== 'cleric'),
})
const heals = healRes.logs.flatMap(t => t.actions).filter(a => a.type === 'heal')
const orgHeals = heals.filter(a => (a as { targetId?: string }).targetId === 'org').length
const mechHeals = heals.filter(a => (a as { targetId?: string }).targetId === 'mech').length
if (orgHeals === 0) throw new Error('healTargetTags: expected organic ally to receive heals, observed none')
if (mechHeals !== 0) throw new Error(\`healTargetTags: mechanical ally received \${mechHeals} heals (expected 0)\`)
for (const u of healRes.survivors) {
  if (u.hp > u.maxHp) throw new Error(\`healTargetTags: unit \${u.id} HP \${u.hp} exceeded maxHp \${u.maxHp}\`)
}
const orgSurvivor = healRes.survivors.find(u => u.id === 'org')
const mechSurvivor = healRes.survivors.find(u => u.id === 'mech')
const controlOrg = controlHealRes.survivors.find(u => u.id === 'org')
const controlMech = controlHealRes.survivors.find(u => u.id === 'mech')

if (!orgSurvivor || orgSurvivor.hp <= 30) {
  throw new Error(\`healTargetTags: organic ally HP did not increase from healing (hp=\${orgSurvivor?.hp}, expected > 30)\`)
}
if (!controlOrg || orgSurvivor.hp <= controlOrg.hp) {
  throw new Error(\`healTargetTags: organic ally HP (\${orgSurvivor.hp}) did not exceed unhealed control (\${controlOrg?.hp})\`)
}
if (!mechSurvivor || mechSurvivor.hp !== 30) {
  throw new Error(\`healTargetTags: mechanical ally HP changed unexpectedly (hp=\${mechSurvivor?.hp}, expected 30)\`)
}
if (!controlMech || mechSurvivor.hp !== controlMech.hp) {
  throw new Error(\`healTargetTags: mechanical ally HP (\${mechSurvivor.hp}) differed from control (\${controlMech?.hp})\`)
}
console.log(\`healTargetTags: orgHeals=\${orgHeals} mechHeals=\${mechHeals} orgHpRecovered=\${orgSurvivor.hp - 30} maxHpCapEnforced=true\`)

// 5. All three timeout policies
const farAttacker = def('fa', { speed: 0 })
const farDefender = def('fd', { speed: 0 })
for (const policy of ['draw', 'attacker_win', 'defender_win'] as const) {
  const tRes = simulateCombat({
    seed: 4646,
    arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
    rules: { maxTicks: 10, timeoutPolicy: policy, defenseResolutionMode: 'v9_snapshot' },
    definitions: { fa: farAttacker, fd: farDefender },
    units: [
      { instanceId: 'a', definitionId: 'fa', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
      { instanceId: 'b', definitionId: 'fd', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
    ],
    scheduledEffects: [],
  })
  const expectedWinner = policy === 'attacker_win' ? 'attacker' : policy === 'defender_win' ? 'defender' : 'draw'
  if (tRes.winner !== expectedWinner) throw new Error(\`timeout policy \${policy}: expected winner \${expectedWinner}, got \${tRes.winner}\`)
  if (tRes.terminationReason !== 'timeout') throw new Error(\`timeout policy \${policy}: expected reason timeout, got \${tRes.terminationReason}\`)
}
console.log('timeoutPolicies: all 3 policies verified (draw, attacker_win, defender_win)')

// 6. Scheduled ticks including delayed mass_shield and simultaneous effects
const shieldAttacker = def('sa', { hp: 500 })
const shieldDefender = def('sd', { hp: 500, speed: 0 })
const runShield = (tick: number, maxTicks: number) => simulateCombat({
  seed: 4747,
  arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
  rules: { maxTicks, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
  definitions: { sa: shieldAttacker, sd: shieldDefender },
  units: [
    { instanceId: 'a', definitionId: 'sa', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
    { instanceId: 'b', definitionId: 'sd', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
  ],
  scheduledEffects: [{ id: 's1', tick, team: 'attacker', type: 'mass_shield', value: 60 }],
})
// Tick 0: applied at tick 0
const sh0 = runShield(0, 1).survivors.find(u => u.id === 'a')
if ((sh0?.maxShield ?? 0) !== 60) throw new Error('scheduled mass_shield at tick 0 not applied')
// Tick 5: before tick 5, no shield
const sh5Before = runShield(5, 5).survivors.find(u => u.id === 'a')
if ((sh5Before?.maxShield ?? 0) !== 0) throw new Error(\`scheduled mass_shield at tick 5 applied prematurely (shield=\${sh5Before?.maxShield})\`)
// Tick 5: at tick 5 (maxTicks 6), shield applied
const sh5After = runShield(5, 6).survivors.find(u => u.id === 'a')
if ((sh5After?.maxShield ?? 0) !== 60) throw new Error('scheduled mass_shield at tick 5 not applied after tick reached')
// Tick 5: at tick 15, shield is still 60 (granted exactly once)
const sh5Later = runShield(5, 15).survivors.find(u => u.id === 'a')
if ((sh5Later?.maxShield ?? 0) !== 60) throw new Error(\`scheduled mass_shield granted multiple times: maxShield=\${sh5Later?.maxShield}\`)
// Beyond battle: tick 100 with maxTicks 1 -> not applied
const shBeyond = runShield(100, 1).survivors.find(u => u.id === 'a')
if ((shBeyond?.maxShield ?? 0) !== 0) throw new Error('scheduled mass_shield beyond battle duration was applied')

// Simultaneous effects sharing tick 3 with verified attribution
const simRes = simulateCombat({
  seed: 4748,
  arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
  rules: { maxTicks: 20, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
  definitions: { sa: shieldAttacker, sd: shieldDefender },
  units: [
    { instanceId: 'a', definitionId: 'sa', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [], currentHp: 100 },
    { instanceId: 'b', definitionId: 'sd', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
  ],
  scheduledEffects: [
    { id: 'emp_same', tick: 3, team: 'attacker', type: 'global_emp', value: 3 },
    { id: 'heal_same', tick: 3, team: 'attacker', type: 'mass_heal', value: 40 },
  ],
})
const tick3Actions = simRes.logs.find(l => l.tick === 3)?.actions ?? []
const empIdx = tick3Actions.findIndex(x => x.type === 'status_apply' && (x as { statusType?: string }).statusType === 'emp')
const healIdx = tick3Actions.findIndex(x => x.type === 'heal')
if (empIdx < 0 || healIdx < 0 || empIdx >= healIdx) throw new Error('simultaneous effects: order violation at tick 3')
const empEvt = tick3Actions[empIdx] as { unitId?: string; statusType?: string }
if (empEvt.unitId !== 'b' || empEvt.statusType !== 'emp') throw new Error('simultaneous effects: emp attribution wrong')
const healEvt = tick3Actions[healIdx] as { targetId?: string; damage?: number }
if (healEvt.targetId !== 'a' || healEvt.damage !== 40) throw new Error('simultaneous effects: heal attribution wrong')
console.log('scheduledTicks: delayed mass_shield, bounds, single grant, and simultaneous effects verified')

// 7. Explicit rejection of unsupported attack (beam and spread) and scheduled effect kinds
for (const badAttackType of ['beam', 'spread'] as const) {
  let rejectedAttack = false
  try {
    simulateCombat({
      seed: 4848,
      arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
      rules: { maxTicks: 10, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: { bad: def('bad', { attackType: badAttackType as unknown as 'single' }) },
      units: [{ instanceId: 'a', definitionId: 'bad', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] }],
      scheduledEffects: [],
    })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'UNSUPPORTED_ATTACK_TYPE') rejectedAttack = true
  }
  if (!rejectedAttack) throw new Error(\`unsupported attackType \${badAttackType} was not rejected with UNSUPPORTED_ATTACK_TYPE\`)
}

let rejectedEffect = false
try {
  simulateCombat({
    seed: 4849,
    arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
    rules: { maxTicks: 10, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
    definitions: { knight },
    units: [{ instanceId: 'a', definitionId: 'knight', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] }],
    scheduledEffects: [{ id: 'apoc', tick: 5, team: 'attacker', type: 'apocalypse_strike', value: 100 }],
  })
} catch (err: unknown) {
  if ((err as { code?: string }).code === 'UNSUPPORTED_SCHEDULED_EFFECT') rejectedEffect = true
}
if (!rejectedEffect) throw new Error('unsupported scheduledEffect apocalypse_strike was not rejected with UNSUPPORTED_SCHEDULED_EFFECT')
console.log('rejections: unsupported attack and scheduled effect kinds explicitly rejected')

// 8. R4a / ISO-10: DTO wire-codec boundary, sentinel stripping, profile: false and JSON round-trip
const rawDirtyUnit = {
  id: 'sentinel_unit',
  type: 'soldier',
  team: 'attacker' as const,
  x: 100,
  y: 200,
  hp: 50,
  maxHp: 50,
  speed: 3,
  range: 4,
  attack: 10,
  _ecsInternalSentinel: 'DO_NOT_LEAK',
}
const serializedUnit = serializeCombatUnitSnapshot(rawDirtyUnit)
if ('_ecsInternalSentinel' in (serializedUnit as Record<string, unknown>)) {
  throw new Error('R4a wire codec failed: _ecsInternalSentinel leaked into serialized CombatSnapshotUnit')
}
if (JSON.stringify(serializedUnit).includes('_ecsInternalSentinel')) {
  throw new Error('R4a wire codec failed: _ecsInternalSentinel leaked into serialized JSON')
}
const deserializedUnit = deserializeCombatUnitSnapshot(serializedUnit)
if ('_ecsInternalSentinel' in deserializedUnit) {
  throw new Error('R4a wire codec failed: _ecsInternalSentinel present in deserialized unit')
}

const boundaryRun = simulateCombat({
  seed: 9999,
  arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
  rules: { maxTicks: 10, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot', profile: false },
  definitions: { knight },
  units: [
    { instanceId: 'a1', definitionId: 'knight', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
    { instanceId: 'd1', definitionId: 'knight', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
  ],
  scheduledEffects: [],
})
if (boundaryRun.profile !== undefined) {
  throw new Error('R4a wire codec failed: profile is not undefined when rules.profile is false')
}
if ('__marsCompat' in (boundaryRun as Record<string, unknown>)) {
  throw new Error('R4a wire codec failed: __marsCompat leaked in CombatRunResult')
}

const encodedReplay = encodeLegacyReplayJson(boundaryRun)
const decodedReplay = decodeLegacyReplayJson(encodedReplay)
if (decodedReplay.winner !== boundaryRun.winner || decodedReplay.elapsedTicks !== boundaryRun.elapsedTicks) {
  throw new Error('R4a wire codec failed: decoded replay does not match simulated result')
}
if (JSON.stringify(decodedReplay) !== JSON.stringify(boundaryRun)) {
  throw new Error('R4a wire codec failed: JSON roundtrip mismatch')
}
console.log('r4aWireCodec: DTO boundary, sentinel isolation, profile: false and round-trip verified')

// 9. R4b / ISO-11: Separate identities for contract, engine, ruleset, and replay
if (!boundaryRun.metadata) throw new Error('R4b failed: metadata missing on CombatRunResult')
if (boundaryRun.metadata.contractVersion !== '1.0.0') throw new Error('R4b failed: unexpected contractVersion')
if (boundaryRun.metadata.engine.id !== '@mars2050/combat-core') throw new Error('R4b failed: unexpected engineId')
if (boundaryRun.metadata.engine.version !== '0.1.0') throw new Error('R4b failed: unexpected engine.version')
if (boundaryRun.metadata.engine.buildId !== 'combat-core-r4b-20261006') throw new Error('R4b failed: unexpected engine.buildId')
if (!boundaryRun.metadata.ruleset.contentHash || boundaryRun.metadata.ruleset.contentHash.length !== 64) {
  throw new Error('R4b failed: invalid ruleset contentHash')
}
if (boundaryRun.metadata.replaySchema.id !== 'combat-replay') throw new Error('R4b failed: unexpected replaySchema.id')
if (boundaryRun.metadata.replaySchema.version !== '1.0.0') throw new Error('R4b failed: unexpected replaySchema.version')
console.log('r4bIdentities: contract, engine, ruleset, and replay schema identities (including buildId) verified')

console.log('All archive runtime verification suites passed successfully.')
`

main()
