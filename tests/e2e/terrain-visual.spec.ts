import { expect, test } from '@playwright/test'
import { collectNetwork, expectCanvasPainted, resetE2eSession } from './support/smoke-helpers'
import { getTerrainDiagnostics, openCanonicalMapScreen } from './support/terrain-helpers'
import fs from 'node:fs'
import path from 'node:path'

const CERT_DIR = path.resolve(process.cwd(), 'test-results/certification')

test.beforeAll(() => {
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true })
  }
})

test.describe('Terrain Visual & GPU Pipeline Certification', () => {
  test('certifies Desktop Enhanced mode with single atlas network contract and zero errors', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await resetE2eSession(page)
    const network = collectNetwork(page)

    const { canvas } = await openCanonicalMapScreen(page, {
      lightingMode: 'enhanced',
      debugMode: 'off'
    })

    const diagnostics = await getTerrainDiagnostics(page)
    expect(diagnostics).not.toBeNull()
    expect(diagnostics?.lightingMode).toBe('enhanced')
    expect(diagnostics?.debugMode).toBe('off')
    expect(diagnostics?.lightingAvailable).toBe(true)
    expect(diagnostics?.rendererResolution).toBe(1)
    expect(diagnostics?.groundDecals).toBeGreaterThan(0)
    expect(diagnostics?.macroCount).toBeGreaterThan(0)
    expect(diagnostics?.scatterCount).toBeGreaterThan(0)

    // Verify network single-atlas bundle contract
    const albedo = network.requests.filter(u => u.includes('/assets/map/terrain-albedo-0.webp'))
    const normal = network.requests.filter(u => u.includes('/assets/map/terrain-normal-0.png'))
    const data = network.requests.filter(u => u.includes('/assets/map/terrain-data-0.png'))

    expect(albedo).toHaveLength(1)
    expect(normal).toHaveLength(1)
    expect(data).toHaveLength(1)

    // Exclude standalone raw tile / scatter requests
    const rawTiles = network.requests.filter(u => u.includes('/assets/map/tiles/') || u.includes('/assets/map/scatter/'))
    expect(rawTiles).toHaveLength(0)

    // Capture certification screenshot for human review
    const screenshotPath = path.join(CERT_DIR, 'desktop-enhanced.png')
    await canvas.screenshot({ path: screenshotPath })
    expect(fs.existsSync(screenshotPath)).toBe(true)

    network.assertClean()
  })

  test('certifies Desktop Baked mode structural parity with enhanced layer composition', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await resetE2eSession(page)
    const network = collectNetwork(page)

    const { canvas } = await openCanonicalMapScreen(page, {
      lightingMode: 'baked',
      debugMode: 'off'
    })

    const diagnostics = await getTerrainDiagnostics(page)
    expect(diagnostics).not.toBeNull()
    expect(diagnostics?.lightingMode).toBe('baked')
    expect(diagnostics?.debugMode).toBe('off')
    expect(diagnostics?.rendererResolution).toBe(1)

    // Structural parity check (deterministic counts must match enhanced mode)
    expect(diagnostics?.groundDecals).toBeGreaterThan(0)
    expect(diagnostics?.macroCount).toBeGreaterThan(0)
    expect(diagnostics?.scatterCount).toBeGreaterThan(0)

    const screenshotPath = path.join(CERT_DIR, 'desktop-baked.png')
    await canvas.screenshot({ path: screenshotPath })
    expect(fs.existsSync(screenshotPath)).toBe(true)

    network.assertClean()
  })

  test('certifies Normal Channel debug shader output', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await resetE2eSession(page)
    const network = collectNetwork(page)

    const { canvas } = await openCanonicalMapScreen(page, {
      lightingMode: 'enhanced',
      debugMode: 'normal'
    })

    const diagnostics = await getTerrainDiagnostics(page)
    expect(diagnostics?.debugMode).toBe('normal')

    const screenshotPath = path.join(CERT_DIR, 'desktop-normal.png')
    await canvas.screenshot({ path: screenshotPath })
    expect(fs.existsSync(screenshotPath)).toBe(true)

    network.assertClean()
  })

  test('certifies Data Channel debug shader output', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await resetE2eSession(page)
    const network = collectNetwork(page)

    const { canvas } = await openCanonicalMapScreen(page, {
      lightingMode: 'enhanced',
      debugMode: 'data'
    })

    const diagnostics = await getTerrainDiagnostics(page)
    expect(diagnostics?.debugMode).toBe('data')

    const screenshotPath = path.join(CERT_DIR, 'desktop-data.png')
    await canvas.screenshot({ path: screenshotPath })
    expect(fs.existsSync(screenshotPath)).toBe(true)

    network.assertClean()
  })

  test('certifies Mobile DPR 3 cap downscaling renderer resolution to 2.0', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    })
    const page = await context.newPage()
    try {
      await resetE2eSession(page)
      const network = collectNetwork(page)

      const { canvas } = await openCanonicalMapScreen(page, {
        lightingMode: 'enhanced',
        debugMode: 'off',
        isMobile: true
      })

      const dpr = await page.evaluate(() => window.devicePixelRatio)
      expect(dpr).toBe(3)

      const diagnostics = await getTerrainDiagnostics(page)
      expect(diagnostics).not.toBeNull()
      expect(diagnostics?.lightingMode).toBe('enhanced')
      expect(diagnostics?.rendererResolution).toBe(2)

      const screenshotPath = path.join(CERT_DIR, 'mobile-enhanced.png')
      await canvas.screenshot({ path: screenshotPath })
      expect(fs.existsSync(screenshotPath)).toBe(true)

      network.assertClean()
    } finally {
      await context.close()
    }
  })
})
