import { expect, test } from '@playwright/test'
import {
  collectNetwork,
  expectBudget,
  expectCanvasPainted,
  resetE2eSession,
  summarizeResourceTimings,
  waitForColony,
} from './support/smoke-helpers'

const PUBLIC_AUTH_SHELL_BUDGET_MS = 1_500
const DESKTOP_FIRST_CANVAS_BUDGET_MS = 6_000
const DESKTOP_FIRST_CANVAS_JS_TRANSFER_BASELINE_BYTES = 1_600_000
const DESKTOP_FIRST_CANVAS_JS_TRANSFER_BUDGET_BYTES = Math.ceil(DESKTOP_FIRST_CANVAS_JS_TRANSFER_BASELINE_BYTES * 1.15)
const DESKTOP_FIRST_CANVAS_JS_CHUNK_BUDGET = 45

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

test('public auth shell stays inside startup budget before app work starts', async ({ page }) => {
  const requestsBeforeShell: string[] = []
  let shellVisible = false

  page.on('request', request => {
    if (!shellVisible) requestsBeforeShell.push(request.url())
  })

  const startedAt = Date.now()
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('public-auth-shell')).toBeVisible({ timeout: PUBLIC_AUTH_SHELL_BUDGET_MS })
  shellVisible = true

  expectBudget(Date.now() - startedAt, PUBLIC_AUTH_SHELL_BUDGET_MS, 'public auth shell visible')
  expect(requestsBeforeShell.filter(isApiRequest), 'API before public auth shell').toEqual([])
  expect(requestsBeforeShell.filter(isSupabaseRest), 'Supabase REST before public auth shell').toEqual([])
})

test('authenticated desktop first canvas stays inside startup budgets', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await resetE2eSession(page)
  const network = collectNetwork(page)

  const startedAt = Date.now()
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForColony(page, 'desktop')
  const firstCanvasMs = Date.now() - startedAt

  const canvas = page.getByTestId('colony-canvas-host').locator('canvas')
  await expectCanvasPainted(canvas)
  const resources = await summarizeResourceTimings(page)
  const resourceDebug = JSON.stringify(resources.topTransfers)

  expectBudget(firstCanvasMs, DESKTOP_FIRST_CANVAS_BUDGET_MS, 'desktop first canvas visible')
  expectBudget(
    resources.nextStaticJsCount,
    DESKTOP_FIRST_CANVAS_JS_CHUNK_BUDGET,
    `desktop first canvas JS chunks; top transfers ${resourceDebug}`,
  )
  expectBudget(
    resources.nextStaticJsTransferBytes,
    DESKTOP_FIRST_CANVAS_JS_TRANSFER_BUDGET_BYTES,
    `desktop first canvas JS transfer; top transfers ${resourceDebug}`,
  )
  expect(network.countPath('/api/colonies/bootstrap')).toBe(1)
  expect(network.countPath('/api/resources')).toBe(0)
  expect(network.countPath('/api/events/process')).toBe(0)
  expect(network.countPath('/api/buildings')).toBe(0)
  expect(resources.supabaseRestCount).toBe(0)
  expect(resources.supabaseAuthCount).toBe(0)
  network.assertClean()
})
