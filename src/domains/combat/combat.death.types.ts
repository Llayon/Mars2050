export const DEATH_CAUSES = [
  'weapon',
  'burn',
  'acid',
  'degeneration',
  'mine',
  'hazard',
  'trigger',
  'expiration',
] as const

export type DeathCause = typeof DEATH_CAUSES[number]
