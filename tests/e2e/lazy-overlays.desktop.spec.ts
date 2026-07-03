import { expect, test } from '@playwright/test'
import { collectNetwork, resetE2eSession, waitForColony } from './support/smoke-helpers'

test('desktop heavy overlays and tabs load only after opening their UI', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await resetE2eSession(page)
  const network = collectNetwork(page)

  await page.goto('/')
  await waitForColony(page, 'desktop')
  expect(network.hasChunk('CommandCenterOverlay')).toBe(false)
  expect(network.hasChunk('GlobalManagementOverlay')).toBe(false)
  expect(network.hasChunk('BattleReplayModal')).toBe(false)
  expect(network.hasChunk('OperationsScreen')).toBe(false)

  await page.getByTestId('command-dock-army').click()
  const commandCenter = page.getByTestId('command-center-overlay')
  await expect(commandCenter).toBeVisible()
  await expect.poll(() => network.hasChunk('CommandCenterOverlay')).toBe(true)
  await expect(commandCenter).toContainText('Current Forces')

  await page.getByTestId('command-center-tab-defense').click()
  await expect(commandCenter).not.toHaveText('')
  await page.getByTestId('command-dock-army').click()
  await expect(commandCenter).toBeHidden()

  await page.getByTestId('command-dock-intel').click()
  const globalOverlay = page.getByTestId('global-management-overlay')
  await expect(globalOverlay).toBeVisible()
  await expect.poll(() => network.hasChunk('GlobalManagementOverlay')).toBe(true)

  for (const tab of ['staffing', 'economy', 'events'] as const) {
    await page.getByTestId(`global-tab-${tab}`).click()
    await expect(globalOverlay).not.toHaveText('')
  }
  network.assertClean()
})
