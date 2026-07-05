import { expect, test } from '@playwright/test'
import { collectNetwork } from './support/smoke-helpers'

test('simulator2 first screen defers replay and Pixi chunks until simulation starts', async ({ page }) => {
  const network = collectNetwork(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()

  expect(network.hasChunk('BattleReplayModal')).toBe(false)
  expect(network.hasChunk('battle-replay-engine')).toBe(false)
  expect(network.hasChunk('pixi')).toBe(false)
  expect(network.countPathPrefix('/api/')).toBe(0)
  network.assertClean()
})
