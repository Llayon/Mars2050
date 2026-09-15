import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const TSCBIN = process.platform === 'win32' ? 'tsc.cmd' : 'tsc'

function run(command: string, cwd: string): string {
  return execSync(command, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
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
import { simulateCombat } from '@mars2050/combat-core'
import type { BattleInput, UnitDefinition } from '@mars2050/combat-core/contracts'

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
if (!spawns.every(a => (a as { spawnTeam?: string }).spawnTeam === 'attacker')) throw new Error('summon team attribution wrong')
const owned = [...s1.survivors, ...s1.initialState].filter(u => u.summonOwnerId !== undefined)
console.log(\`summon: impSpawns=\${spawns.length} attributedSurvivors=\${owned.length}\`)
if (owned.length === 0) throw new Error('no summoned unit carries summonOwnerId')

console.log('Archive runtime verification passed successfully.')
`

main()
