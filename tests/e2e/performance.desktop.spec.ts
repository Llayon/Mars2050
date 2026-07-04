import { expect, test } from '@playwright/test'
import {
  collectNetwork,
  expectBudget,
  expectCanvasPainted,
  expectLoadMilestone,
  readLoadMilestones,
  resetE2eSession,
  summarizeResourceTimings,
  waitForColony,
} from './support/smoke-helpers'
import {
  DESKTOP_FIRST_CANVAS_JS_TRANSFER_BUDGET_BYTES,
  EARLY_GAME_API_DENYLIST,
  PERF_BUDGETS,
  PUBLIC_ENTRY_HEAVY_CHUNK_MARKERS,
} from './support/perf-budgets'

function isSupabaseRest(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.host.endsWith('.supabase.co') && parsed.pathname.startsWith('/rest/v1')
  } catch {
    return false
  }
}

function isApiRequest(url: string): boolean {
  try {
    return new URL(url).pathname.startsWith('/api/')
  } catch {
    return false
  }
}

function hasHeavyPublicChunk(url: string): boolean {
  return PUBLIC_ENTRY_HEAVY_CHUNK_MARKERS.some(marker => url.includes(marker))
}

test('public auth shell stays inside startup budget before app work starts', async ({ page }) => {
  const requestsBeforeShell: string[] = []
  let shellVisible = false

  page.on('request', request => {
    if (!shellVisible) requestsBeforeShell.push(request.url())
  })

  const startedAt = Date.now()
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('public-auth-shell')).toBeVisible({ timeout: PERF_BUDGETS.publicAuthShellMs })
  shellVisible = true

  await expectLoadMilestone(page, 'public-shell')
  expectBudget(Date.now() - startedAt, PERF_BUDGETS.publicAuthShellMs, 'public auth shell visible')
  expect(requestsBeforeShell.filter(isApiRequest), 'API before public auth shell').toEqual([])
  expect(requestsBeforeShell.filter(isSupabaseRest), 'Supabase REST before public auth shell').toEqual([])
  expect(requestsBeforeShell.filter(hasHeavyPublicChunk), 'heavy game chunks before public auth shell').toEqual([])
})

test('authenticated desktop first canvas stays inside startup budgets', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await resetE2eSession(page)
  const network = collectNetwork(page)

  const startedAt = Date.now()
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForColony(page, 'desktop')
  await expectLoadMilestone(page, 'first-canvas')
  const firstCanvasMs = Date.now() - startedAt
  await expectLoadMilestone(page, 'bootstrap-end')

  const canvas = page.getByTestId('colony-canvas-host').locator('canvas')
  await expectCanvasPainted(canvas)
  const resources = await summarizeResourceTimings(page)
  const resourceDebug = JSON.stringify(resources.topTransfers)
  const milestones = await readLoadMilestones(page)

  expect(milestones.map(mark => mark.name)).toEqual(expect.arrayContaining(['bootstrap-start', 'bootstrap-end', 'first-canvas']))
  expectBudget(firstCanvasMs, PERF_BUDGETS.desktopFirstCanvasMs, 'desktop first canvas visible')
  expectBudget(
    resources.nextStaticJsCount,
    PERF_BUDGETS.desktopFirstCanvasJsChunkCount,
    `desktop first canvas JS chunks; top transfers ${resourceDebug}`,
  )
  expectBudget(
    resources.nextStaticJsTransferBytes,
    DESKTOP_FIRST_CANVAS_JS_TRANSFER_BUDGET_BYTES,
    `desktop first canvas JS transfer; top transfers ${resourceDebug}`,
  )
  expect(network.countPath('/api/colonies/bootstrap')).toBe(1)
  for (const path of EARLY_GAME_API_DENYLIST) expect(network.countPath(path)).toBe(0)
  expect(resources.supabaseRestCount).toBe(0)
  expect(resources.supabaseAuthCount).toBe(0)
  network.assertClean()
})

test('authenticated desktop reload uses cached colony while fresh bootstrap is pending', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await resetE2eSession(page)
  const sessionResponse = await page.request.get('/api/e2e/session')
  const session = await sessionResponse.json()
  const colonyId = session.colonyId as string
  const userId = session.user.id as string
  const url = baseURL ?? 'http://127.0.0.1:3100'
  const cachedPayload = {
    colony: {
      id: colonyId,
      name: 'Cached Alpha',
      level: 1,
      experience: 0,
      user_id: userId,
      last_calc_at: '2026-07-04T12:00:00.000Z',
      created_at: '2026-07-04T11:00:00.000Z',
      terrain_grid: [{ x: 0, y: 0, t: 'regolith' }],
      unlocked_radius: 5,
    },
    resources: [],
    buildings: [{
      id: '550e8400-e29b-41d4-a716-446655440020',
      colony_id: colonyId,
      type: 'solar_panels',
      name: 'Cached Solar',
      level: 1,
      is_active: true,
      x: 0,
      y: 0,
      staffing_mode: 'auto',
      assigned_workers: 0,
      work_priority: 'normal',
      paused: false,
      created_at: '2026-07-04T11:00:00.000Z',
      updated_at: '2026-07-04T12:00:00.000Z',
    }],
    population: null,
  }

  await page.context().addCookies([{ name: 'supabase-access-token', value: 'resume-marker', url }])
  await page.addInitScript(({ id, payload }) => {
    localStorage.setItem(`mars2050_bootstrap:${id}`, JSON.stringify({
      schemaVersion: 1,
      savedAt: Date.now(),
      data: payload,
    }))
  }, { id: colonyId, payload: cachedPayload })
  await page.route('**/api/colonies/bootstrap**', async route => {
    await new Promise(resolve => setTimeout(resolve, 2000))
    await route.continue()
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('public-auth-shell')).toBeHidden()
  await waitForColony(page, 'desktop')
  await expectLoadMilestone(page, 'cached-bootstrap-used')
  await expect(page.getByText('Cached Alpha')).toBeVisible()
  await expect(page.getByTestId('resume-sync-status')).toBeVisible()

  await expectLoadMilestone(page, 'fresh-bootstrap-end')
  await expect(page.getByTestId('resume-sync-status')).toBeHidden()
})
