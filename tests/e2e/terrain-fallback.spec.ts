import { expect, test } from '@playwright/test'
import { expectCanvasPainted, resetE2eSession, waitForColony } from './support/smoke-helpers'
import { getTerrainDiagnostics } from './support/terrain-helpers'

test.describe('Terrain Companion Fallback Suite', () => {
  test('gracefully falls back to baked Albedo when normal/data textures fail to load', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Return 404 for companion normal/data textures
    await page.route('**/assets/map/*normal*', route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' }))
    await page.route('**/assets/map/*data*', route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' }))

    await resetE2eSession(page)
    await page.goto('/')
    await waitForColony(page, 'desktop')

    // Open Map via CommandDock
    await page.getByTestId('command-dock-map').click()

    const canvasHost = page.getByTestId('mars-map-canvas-host')
    await expect(canvasHost).toBeVisible({ timeout: 30_000 })

    const canvas = canvasHost.locator('canvas')
    await expect(canvas).toBeVisible({ timeout: 30_000 })
    await expectCanvasPainted(canvas)

    // Wait for diagnostics to register
    await expect.poll(async () => {
      const diag = await getTerrainDiagnostics(page)
      return !!diag
    }, { timeout: 30_000 }).toBe(true)

    const diagnostics = await getTerrainDiagnostics(page)
    expect(diagnostics).not.toBeNull()
    expect(diagnostics?.lightingAvailable).toBe(false)
    expect(diagnostics?.groundDecals).toBeGreaterThan(0)
    expect(diagnostics?.macroCount).toBeGreaterThan(0)
  })
})
