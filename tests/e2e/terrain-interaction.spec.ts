import { expect, test } from '@playwright/test'
import { collectNetwork, resetE2eSession } from './support/smoke-helpers'
import { openCanonicalMapScreen } from './support/terrain-helpers'

test.describe('Terrain Interaction Suite', () => {
  test('supports viewport drag pan, mode switching, and POI selection without errors', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await resetE2eSession(page)
    const network = collectNetwork(page)

    const { canvasHost, canvas } = await openCanonicalMapScreen(page, {
      lightingMode: 'enhanced',
      debugMode: 'off'
    })

    // Test drag-panning on the canvas
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    if (box) {
      const startX = box.x + box.width / 2
      const startY = box.y + box.height / 2
      await page.mouse.move(startX, startY)
      await page.mouse.down()
      await page.mouse.move(startX + 100, startY + 60, { steps: 5 })
      await page.mouse.up()
    }

    // Switch to Grid mode
    const gridBtn = page.getByRole('button', { name: 'Сетка' })
    if (await gridBtn.isVisible()) {
      await gridBtn.click()
      await page.waitForTimeout(300)

      // In Grid mode, click first location tile
      const firstTile = page.locator('button:has(span.text-lg)').first()
      if (await firstTile.isVisible()) {
        await firstTile.click()
        // Location details panel should be visible
        await expect(page.locator('text=Сложность:')).toBeVisible({ timeout: 5_000 })
      }

      // Switch back to 2.5D view
      const view25dBtn = page.getByRole('button', { name: '2.5D' })
      await view25dBtn.click()
      await expect(canvasHost).toBeVisible()
    }

    network.assertClean()
  })

  test('supports touch drag panning on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await resetE2eSession(page)
    const network = collectNetwork(page)

    const { canvas } = await openCanonicalMapScreen(page, {
      lightingMode: 'enhanced',
      debugMode: 'off',
      isMobile: true
    })

    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    if (box) {
      const startX = box.x + box.width / 2
      const startY = box.y + box.height / 2
      await page.mouse.move(startX, startY)
      await page.mouse.down()
      await page.mouse.move(startX + 50, startY + 30, { steps: 3 })
      await page.mouse.up()
    }

    network.assertClean()
  })
})
