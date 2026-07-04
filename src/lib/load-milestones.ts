export const LOAD_MILESTONE_PREFIX = 'mars2050:load:'

export const LOAD_MILESTONE_NAMES = [
  'public-shell',
  'auth-resume',
  'bootstrap-start',
  'bootstrap-end',
  'cached-bootstrap-used',
  'first-canvas',
  'game-shell-mounted',
  'fresh-bootstrap-end',
  'late-assets-ready',
  'overlay-open',
  'resume-overlay-hidden',
] as const

export type LoadMilestoneName = typeof LOAD_MILESTONE_NAMES[number]

export interface LoadMilestone {
  name: LoadMilestoneName
  startTime: number
}

export function markLoadMilestone(name: LoadMilestoneName): void {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return
  performance.mark(`${LOAD_MILESTONE_PREFIX}${name}`)
}

export function getLoadMilestones(): LoadMilestone[] {
  if (typeof performance === 'undefined') return []
  return performance
    .getEntriesByType('mark')
    .filter(entry => entry.name.startsWith(LOAD_MILESTONE_PREFIX))
    .map(entry => ({
      name: entry.name.slice(LOAD_MILESTONE_PREFIX.length) as LoadMilestoneName,
      startTime: entry.startTime,
    }))
}
