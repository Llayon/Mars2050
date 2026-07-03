import { expect, test } from '@playwright/test'
import { collectNetwork, resetE2eSession, waitForColony } from './support/smoke-helpers'

test('mobile TWA-like tabs open non-empty sheets above a stable bottom nav', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await resetE2eSession(page)
  const network = collectNetwork(page)

  await page.goto('/?e2e_twa=1')
  await waitForColony(page, 'mobile')
  await expect(page.getByTestId('top-resource-bar')).toBeVisible()
  await expect(page.getByTestId('bottom-nav')).toBeVisible()

  for (const tab of ['map', 'operations', 'population', 'profile'] as const) {
    await page.getByTestId(`bottom-nav-${tab}`).click()
    await expect(page.getByTestId('hud-bottom-sheet')).toBeVisible()
    await expect(page.getByTestId(`${tab}-screen`)).toBeVisible()
    await expect(page.getByTestId('bottom-nav')).toBeVisible()
    await expect(page.getByTestId('hud-bottom-sheet')).not.toHaveText('')
  }

  const sheetBox = await page.getByTestId('hud-bottom-sheet').boundingBox()
  const navBox = await page.getByTestId('bottom-nav').boundingBox()
  expect(sheetBox).not.toBeNull()
  expect(navBox).not.toBeNull()
  expect(navBox!.y).toBeGreaterThan(sheetBox!.y)

  await page.mouse.move(190, 620)
  await page.mouse.down()
  await page.mouse.move(190, 500)
  await page.mouse.up()
  await expect(page.getByTestId('colony-canvas-host').locator('canvas')).toBeVisible()
  network.assertClean()
})
