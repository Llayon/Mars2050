import { expect, test } from '@playwright/test'
import { collectNetwork, expectCanvasPainted, expectLoadMilestone, resetE2eSession, waitForColony } from './support/smoke-helpers'

test('canvas appears before late assets finish and survives responsive resize', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await resetE2eSession(page)
  const delayedAssets: string[] = []

  await page.route(/\/assets\/terrain\/(ice_pocket|iron_deposit|blocked_rock|geothermal)\.svg$/, async route => {
    delayedAssets.push(route.request().url())
    await new Promise(resolve => setTimeout(resolve, 1500))
    await route.continue()
  })
  await page.route('**/assets/buildings/*.webp', async route => {
    delayedAssets.push(route.request().url())
    await new Promise(resolve => setTimeout(resolve, 1500))
    await route.continue()
  })

  const network = collectNetwork(page)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForColony(page, 'desktop')

  const canvas = page.getByTestId('colony-canvas-host').locator('canvas')
  await expectCanvasPainted(canvas)
  await expect.poll(() => delayedAssets.length, { timeout: 5000 }).toBeGreaterThan(0)

  await page.waitForTimeout(1800)
  await expectCanvasPainted(canvas)
  await expectLoadMilestone(page, 'late-assets-ready')

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(canvas).toBeVisible()
  await expectCanvasPainted(canvas)
  network.assertClean()
})
