export const PERF_BUDGETS = {
  publicAuthShellMs: 1_500,
  desktopFirstCanvasMs: 6_000,
  desktopFirstCanvasJsTransferBaselineBytes: 1_600_000,
  desktopFirstCanvasJsChunkCount: 45,
} as const

export const DESKTOP_FIRST_CANVAS_JS_TRANSFER_BUDGET_BYTES = Math.ceil(
  PERF_BUDGETS.desktopFirstCanvasJsTransferBaselineBytes * 1.15,
)

export const EARLY_GAME_API_DENYLIST = [
  '/api/resources',
  '/api/events/process',
  '/api/buildings',
] as const

export const OVERLAY_API_PREFIXES = [
  '/api/combat/',
  '/api/leaderboard',
  '/api/resources/debug',
  '/api/work-orders',
] as const

export const PUBLIC_ENTRY_HEAVY_CHUNK_MARKERS = [
  'GameShell',
  'DesktopHud',
  'TwaHud',
  'ColonyCanvas',
  'BattleReplayModal',
  'CommandCenterOverlay',
  'GlobalManagementOverlay',
  'pixi',
] as const
