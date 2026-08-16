import { expect, test } from '@playwright/test'
import { collectNetwork, expectCanvasPainted, resetE2eSession, waitForColony } from './support/smoke-helpers'

test('desktop map command opens canonical MapScreen and MarsMapCanvas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await resetE2eSession(page)
  const network = collectNetwork(page)

  await page.goto('/')
  await waitForColony(page, 'desktop')

  // Open Map via CommandDock
  await page.getByTestId('command-dock-map').click()

  // Verify canonical MapScreen and MarsMapCanvas host are rendered
  const mapScreen = page.getByTestId('map-screen')
  await expect(mapScreen).toBeVisible()

  const mapCanvasHost = page.getByTestId('mars-map-canvas-host')
  await expect(mapCanvasHost).toBeVisible()

  const canvas = mapCanvasHost.locator('canvas')
  await expect(canvas).toBeVisible({ timeout: 15_000 })
  await expectCanvasPainted(canvas)

  // Switch back to Colony view
  await page.getByTestId('command-dock-colony').click()
  await expect(mapScreen).toBeHidden()

  network.assertClean()
})
