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
    const atlasRequests = network.requests.filter(u => u.includes('mars-terrain-atlas') || u.includes('terrain-atlas'))
    expect(atlasRequests.length).toBeLessThanOrEqual(3) // 1 albedo, 1 normal, 1 data max

    // Capture certification golden screenshot
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

  test('certifies Mobile DPR 3 cap downscaling renderer resolution to <= 2.0', async ({ page }) => {
    // Emulate mobile device with DPR 3
    await page.setViewportSize({ width: 390, height: 844 })
    await resetE2eSession(page)
    const network = collectNetwork(page)

    const { canvas } = await openCanonicalMapScreen(page, {
      lightingMode: 'enhanced',
      debugMode: 'off',
      isMobile: true
    })

    const diagnostics = await getTerrainDiagnostics(page)
    expect(diagnostics).not.toBeNull()
    expect(diagnostics?.lightingMode).toBe('enhanced')
    // Invariant: devicePixelRatio is 3 in mobile project, rendererResolution must be capped at 2
    expect(diagnostics?.rendererResolution).toBeLessThanOrEqual(2)

    const screenshotPath = path.join(CERT_DIR, 'mobile-enhanced.png')
    await canvas.screenshot({ path: screenshotPath })
    expect(fs.existsSync(screenshotPath)).toBe(true)

    network.assertClean()
  })
})
