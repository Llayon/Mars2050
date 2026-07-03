import { expect, test } from '@playwright/test'
import { collectNetwork, expectCanvasPainted, placeSolarPanel, resetE2eSession, waitForColony } from './support/smoke-helpers'

test('desktop build catalog enters placement and creates a building without reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await resetE2eSession(page)
  const network = collectNetwork(page)

  await page.goto('/')
  await waitForColony(page, 'desktop')
  expect(network.countPath('/api/buildings')).toBe(0)

  const response = await placeSolarPanel(page)
  if (response) expect(response.ok()).toBe(true)
  await expect(page.getByTestId('placement-action-bar')).toBeHidden()
  await expect(page.getByTestId('desktop-hud')).toBeVisible()
  expect(network.countPath('/api/colonies/bootstrap')).toBe(1)
  expect(network.countPath('/api/buildings')).toBe(1)

  await expectCanvasPainted(page.getByTestId('colony-canvas-host').locator('canvas'))
  network.assertClean()
})
