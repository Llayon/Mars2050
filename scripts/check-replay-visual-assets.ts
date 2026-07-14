import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getReplayVisualCoverageIssues, getReplayVisualCoverageSummary } from '@/components/game/battle-replay-visual-contract'
import { UNIT_TYPES } from '@/domains/combat/combat.config'

function main(): void {
  const args = new Set(process.argv.slice(2))
  const unitTypes = Object.keys(UNIT_TYPES)
  const issues = getReplayVisualCoverageIssues(unitTypes, assetExists)
  const summary = getReplayVisualCoverageSummary(unitTypes)
  const result = {
    status: issues.length === 0 ? 'passed' : 'failed',
    summary,
    issues,
  }

  if (args.has('--json')) {
    console.log(JSON.stringify(result, null, 2))
  } else if (issues.length === 0) {
    console.log(`Replay visual assets passed: ${summary.directAssetCount}/${summary.unitCount} direct assets, ${summary.exemptionCount} exemptions.`)
  } else {
    console.error('Replay visual asset coverage failed:')
    for (const issue of issues) console.error(`- ${issue.type}: ${issue.code} (${issue.detail})`)
  }

  if (issues.length > 0) process.exitCode = 1
}

function assetExists(publicPath: string): boolean {
  return existsSync(join(process.cwd(), 'public', publicPath.replace(/^\//, '')))
}

main()
