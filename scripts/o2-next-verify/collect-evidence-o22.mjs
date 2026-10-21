// O2.2 evidence collector: copies the compact profile summaries and diagnostics into the evidence
// tree, writes environment.json, the source patch and a per-file SHA256 index. Raw V8 profiles stay
// in the lab (sizes and hashes are recorded instead). No tmp/tsx/cache/node_modules contents are
// copied.
//
//   node scripts/o2-next-verify/collect-evidence-o22.mjs
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const LAB = resolve('D:/Max/o2')
const EVIDENCE = join(LAB, 'evidence-o22')
const PROFILE_SRC = join(LAB, 'profiles-o22')
const PROFILE_DST = join(EVIDENCE, 'profiles')
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex')

mkdirSync(PROFILE_DST, { recursive: true })

const summaryFiles = readdirSync(PROFILE_SRC)
  .filter(name => name.endsWith('.json') && !name.includes('profile'))
  .sort()
for (const name of summaryFiles) copyFileSync(join(PROFILE_SRC, name), join(PROFILE_DST, name))

const rawProfiles = readdirSync(PROFILE_SRC)
  .filter(name => name.endsWith('.cpuprofile') || name.endsWith('.heapprofile'))
  .sort()
  .map(name => ({
    file: name,
    bytes: statSync(join(PROFILE_SRC, name)).size,
    sha256: sha256(join(PROFILE_SRC, name)),
    keptInLab: join(PROFILE_SRC, name).replace(/\\/g, '/'),
  }))

const environment = {
  generatedAt: new Date().toISOString(),
  host: {
    os: execFileSync('cmd', ['/c', 'ver'], { encoding: 'utf8' }).trim(),
    cpu: 'AMD Ryzen 5 5600H with Radeon Graphics, 6 cores / 12 threads',
    platform: `${process.platform}-${process.arch}`,
  },
  node: {
    main: execFileSync('D:/Max/fantasy-battles/.tools/node26/node.exe', ['-v'], { encoding: 'utf8' }).trim(),
    extra: {
      '22': execFileSync('D:/Max/o2/tmp/node-v22.20.0-win-x64/node.exe', ['-v'], { encoding: 'utf8' }).trim(),
      '25': execFileSync('node', ['-v'], { encoding: 'utf8' }).trim(),
    },
  },
  chromium: '155.0.8059.85 (channel chrome, Playwright)',
  fantasyStand: 'D:/Max/fantasy-battles (read-only), portable toolchain .tools/node26',
  note: 'The whole station drifted badly during the session (the same battle ranged 245-693 ms); paired ratios and per-pair deltas are the primary statistics, absolute medians are reported per block with their spread.',
}

const patch = execFileSync('git', ['diff', 'a0555753aa9703bbcd09159358acf60c533ecd66', '--', 'packages/combat-core/src'], { cwd: REPO, encoding: 'utf8' })
writeFileSync(join(EVIDENCE, 'o22-source-diff.patch'), patch, 'utf8')

const branchDiff = execFileSync('git', ['diff', 'a0555753aa9703bbcd09159358acf60c533ecd66', '--stat'], { cwd: REPO, encoding: 'utf8' })
writeFileSync(join(EVIDENCE, 'o22-branch-diff-stat.txt'), branchDiff.replace(/\r\n/g, '\n'), 'utf8')

writeFileSync(join(EVIDENCE, 'environment.json'), `${JSON.stringify({ ...environment, rawProfiles }, null, 2)}\n`, 'utf8')

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['tmp', 'node_modules', '.cache'].includes(entry.name)) continue
      out.push(...walk(full))
    } else if (entry.isFile() && entry.name !== 'index.json') {
      out.push(full)
    }
  }
  return out
}

const files = walk(EVIDENCE).sort()
const index = {
  generatedAt: new Date().toISOString(),
  fileCount: files.length,
  totalBytes: files.reduce((sum, file) => sum + statSync(file).size, 0),
  files: Object.fromEntries(files.map(file => [relative(EVIDENCE, file).split('\\').join('/'), {
    bytes: statSync(file).size,
    sha256: sha256(file),
  }])),
}
writeFileSync(join(EVIDENCE, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({
  evidence: EVIDENCE.replace(/\\/g, '/'),
  files: index.fileCount,
  totalBytes: index.totalBytes,
  profiles: rawProfiles.length,
  patchBytes: patch.length,
  patchSha256: createHash('sha256').update(patch).digest('hex'),
}, null, 2))
