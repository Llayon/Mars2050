import { expect, test } from '@playwright/test'
import { collectNetwork, expectCanvasPainted, resetE2eSession, waitForColony } from './support/smoke-helpers'

test('desktop first load uses one bootstrap payload and renders the colony canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await resetE2eSession(page)
  const network = collectNetwork(page)

  await page.goto('/')
  await waitForColony(page, 'desktop')

  await expect(page.getByTestId('top-hud')).toBeVisible()
  await expect(page.getByTestId('resource-strip')).toBeVisible()
  const canvas = page.getByTestId('colony-canvas-host').locator('canvas')
  await expectCanvasPainted(canvas)

  expect(network.countPath('/api/colonies/bootstrap')).toBe(1)
  expect(network.countPath('/api/resources')).toBe(0)
  expect(network.countPath('/api/events/process')).toBe(0)
  expect(network.countPath('/api/buildings')).toBe(0)
  network.assertClean()
})
