import { expect, type Locator, type Page, type Response } from '@playwright/test'
import sharp from 'sharp'

export interface NetworkCollector {
  requests: string[]
  consoleErrors: string[]
  pageErrors: string[]
  failedRequests: string[]
  badResponses: string[]
  countPath: (path: string) => number
  countPathPrefix: (prefix: string) => number
  hasChunk: (name: string) => boolean
  assertClean: () => void
}

export interface BrowserLoadMilestone {
  name: string
  startTime: number
}

export interface ResourceTimingSummary {
  nextStaticJsCount: number
  nextStaticJsTransferBytes: number
  nextStaticCssTransferBytes: number
  apiCount: number
  supabaseRestCount: number
  supabaseAuthCount: number
  topTransfers: ResourceTransfer[]
}

interface BrowserResourceTiming {
  host: string
  path: string
  transferBytes: number
  encodedBytes: number
  decodedBytes: number
  durationMs: number
}

interface ResourceTransfer {
  path: string
  transferBytes: number
  encodedBytes: number
  durationMs: number
}

function pathname(url: string): string | null {
  try {
    return new URL(url).pathname
  } catch {
    return null
  }
}

function isNextStaticChunk(entry: BrowserResourceTiming, extension: '.js' | '.css'): boolean {
  return entry.path.startsWith('/_next/static/chunks/') && entry.path.endsWith(extension)
}

function isSupabaseHost(host: string): boolean {
  return host.endsWith('.supabase.co')
}

function resourceSize(entry: BrowserResourceTiming): number {
  return Math.max(entry.transferBytes, entry.encodedBytes, 0)
}

export function collectNetwork(page: Page): NetworkCollector {
  const requests: string[] = []
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const failedRequests: string[] = []
  const badResponses: string[] = []

  page.on('request', request => {
    requests.push(request.url())
  })
  page.on('requestfailed', request => {
    const url = request.url()
    if (!url.includes('/_next/webpack-hmr')) failedRequests.push(`${request.method()} ${url}`)
  })
  page.on('response', response => {
    if (response.status() >= 400) {
      badResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', error => {
    pageErrors.push(error.message)
  })

  return {
    requests,
    consoleErrors,
    pageErrors,
    failedRequests,
    badResponses,
    countPath: (path: string) => requests.filter(url => pathname(url) === path).length,
    countPathPrefix: (prefix: string) => requests.filter(url => pathname(url)?.startsWith(prefix)).length,
    hasChunk: (name: string) => requests.some(url => url.includes('/_next/static/chunks/') && url.includes(name)),
    assertClean: () => {
      expect(consoleErrors, 'console errors').toEqual([])
      expect(pageErrors, 'page errors').toEqual([])
      expect(failedRequests, 'failed requests').toEqual([])
      expect(badResponses, 'bad responses').toEqual([])
    },
  }
}

export async function readLoadMilestones(page: Page): Promise<BrowserLoadMilestone[]> {
  return page.evaluate(() => performance.getEntriesByType('mark')
    .filter(entry => entry.name.startsWith('mars2050:load:'))
    .map(entry => ({ name: entry.name.replace('mars2050:load:', ''), startTime: Math.round(entry.startTime) }))
  )
}

export async function expectLoadMilestone(page: Page, name: string): Promise<void> {
  await expect.poll(async () => (await readLoadMilestones(page)).some(mark => mark.name === name)).toBe(true)
}

export async function summarizeResourceTimings(page: Page): Promise<ResourceTimingSummary> {
  const entries = await page.evaluate(() => {
    return (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).flatMap(entry => {
      try {
        const parsed = new URL(entry.name)
        return [{
          host: parsed.host,
          path: parsed.pathname,
          transferBytes: Math.max(0, Math.round(entry.transferSize || 0)),
          encodedBytes: Math.max(0, Math.round(entry.encodedBodySize || 0)),
          decodedBytes: Math.max(0, Math.round(entry.decodedBodySize || 0)),
          durationMs: Math.max(0, Math.round(entry.duration || 0)),
        }]
      } catch {
        return []
      }
    })
  })

  const jsEntries = entries.filter(entry => isNextStaticChunk(entry, '.js'))
  const cssEntries = entries.filter(entry => isNextStaticChunk(entry, '.css'))

  return {
    nextStaticJsCount: jsEntries.length,
    nextStaticJsTransferBytes: jsEntries.reduce((sum, entry) => sum + resourceSize(entry), 0),
    nextStaticCssTransferBytes: cssEntries.reduce((sum, entry) => sum + resourceSize(entry), 0),
    apiCount: entries.filter(entry => entry.path.startsWith('/api/')).length,
    supabaseRestCount: entries.filter(entry => isSupabaseHost(entry.host) && entry.path.startsWith('/rest/v1')).length,
    supabaseAuthCount: entries.filter(entry => isSupabaseHost(entry.host) && entry.path.startsWith('/auth/v1')).length,
    topTransfers: entries
      .map(entry => ({
        path: entry.path,
        transferBytes: resourceSize(entry),
        encodedBytes: entry.encodedBytes,
        durationMs: entry.durationMs,
      }))
      .sort((left, right) => right.transferBytes - left.transferBytes)
      .slice(0, 8),
  }
}

export function expectBudget(actual: number, max: number, label: string): void {
  expect(actual, `${label}: expected ${actual} <= ${max}`).toBeLessThanOrEqual(max)
}

export async function resetE2eSession(page: Page): Promise<void> {
  const session = await page.request.get('/api/e2e/session')
  expect(session.ok(), await session.text()).toBe(true)
  const reset = await page.request.post('/api/e2e/reset', { data: {} })
  expect(reset.ok(), await reset.text()).toBe(true)
}

export async function waitForColony(page: Page, mode: 'desktop' | 'mobile' = 'desktop'): Promise<void> {
  await expect(page.getByTestId(mode === 'desktop' ? 'desktop-hud' : 'twa-hud')).toBeVisible()
  await expect(page.getByTestId('colony-screen')).toBeVisible()
  await expect(page.getByTestId('colony-canvas-host').locator('canvas')).toBeVisible({ timeout: 60_000 })
}

export async function expectCanvasPainted(canvas: Locator): Promise<void> {
  const buffer = await canvas.screenshot()
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let coloredPixels = 0
  const pixelCount = info.width * info.height
  const stride = Math.max(1, Math.floor(pixelCount / 5000))

  for (let pixel = 0; pixel < pixelCount; pixel += stride) {
    const index = pixel * 4
    const alpha = data[index + 3]
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    if (alpha > 0 && (red > 12 || green > 12 || blue > 12)) coloredPixels++
  }

  expect(coloredPixels, 'canvas should contain non-black rendered pixels').toBeGreaterThan(20)
}

export async function placeSolarPanel(page: Page): Promise<Response | null> {
  await page.getByTestId('command-dock-build').click()
  await expect(page.getByTestId('build-catalog-sheet')).toBeVisible()
  await page.getByTestId('build-card-solar_panels').click()
  await expect(page.getByTestId('placement-action-bar')).toBeVisible()

  const canvas = page.getByTestId('colony-canvas-host').locator('canvas')
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  const positions = [
    { x: box!.width / 2, y: box!.height / 2 },
    { x: box!.width / 2 + 32, y: box!.height / 2 },
    { x: box!.width / 2 - 32, y: box!.height / 2 },
    { x: box!.width / 2, y: box!.height / 2 + 24 },
    { x: box!.width / 2, y: box!.height / 2 - 24 },
  ]

  for (const position of positions) {
    const responsePromise = page.waitForResponse(response => {
      return pathname(response.url()) === '/api/buildings' && response.request().method() === 'POST'
    }, { timeout: 2500 }).catch(() => null)
    await canvas.click({ position })
    const response = await responsePromise
    if (response?.ok()) return response
    if (await page.getByTestId('placement-action-bar').isHidden().catch(() => false)) return response
  }

  throw new Error('Failed to place solar panel through the canvas')
}
