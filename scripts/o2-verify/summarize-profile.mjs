// Summarizes a V8 .cpuprofile (self time per function) or .heapprofile (self allocated bytes per
// call frame). Output is deterministic JSON so profile diffs can be committed as evidence.
//   node summarize-profile.mjs <profile> [--top 25] [--filter <substring>]
import { readFileSync } from 'node:fs'

const [, , file, ...rest] = process.argv
const topIndex = rest.indexOf('--top')
const top = topIndex >= 0 ? Number(rest[topIndex + 1]) : 25
const filterIndex = rest.indexOf('--filter')
const filter = filterIndex >= 0 ? rest[filterIndex + 1] : ''

const profile = JSON.parse(readFileSync(file, 'utf8'))
const clean = url => url.replace(/^file:\/\/\//, '').replace(/^file:\/\//, '').replace(/\\/g, '/')

const isCpu = Array.isArray(profile.nodes) && Array.isArray(profile.samples)

if (isCpu) {
  const byId = new Map(profile.nodes.map(node => [node.id, node]))
  const self = new Map()
  const total = profile.samples.length
  for (const id of profile.samples) {
    const node = byId.get(id)
    if (!node) continue
    const frame = node.callFrame
    const key = `${frame.functionName || '(anonymous)'}|${clean(frame.url)}|${frame.lineNumber}`
    self.set(key, (self.get(key) ?? 0) + 1)
  }
  const rows = [...self.entries()]
    .map(([key, count]) => {
      const [functionName, url, line] = key.split('|')
      return { functionName, url, line: Number(line) + 1, samples: count, share: count / total }
    })
    .filter(row => !filter || `${row.functionName} ${row.url}`.includes(filter))
    .sort((a, b) => b.samples - a.samples)
  const timeDeltas = profile.timeDeltas ?? []
  const totalMicros = timeDeltas.reduce((sum, delta) => sum + delta, 0)
  console.log(JSON.stringify({
    file, kind: 'cpuprofile', sampleCount: total, totalMicros,
    top: rows.slice(0, top),
  }, null, 2))
} else {
  const self = new Map()
  let total = 0
  const walk = node => {
    const frame = node.callFrame
    const key = `${frame.functionName || '(anonymous)'}|${clean(frame.url)}|${frame.lineNumber}`
    const size = node.selfSize ?? 0
    total += size
    self.set(key, (self.get(key) ?? 0) + size)
    for (const child of node.children ?? []) walk(child)
  }
  walk(profile.head)
  const rows = [...self.entries()]
    .map(([key, bytes]) => {
      const [functionName, url, line] = key.split('|')
      return { functionName, url, line: Number(line) + 1, bytes, share: total ? bytes / total : 0 }
    })
    .filter(row => !filter || `${row.functionName} ${row.url}`.includes(filter))
    .sort((a, b) => b.bytes - a.bytes)
  console.log(JSON.stringify({ file, kind: 'heapprofile', totalSelfBytes: total, top: rows.slice(0, top) }, null, 2))
}
