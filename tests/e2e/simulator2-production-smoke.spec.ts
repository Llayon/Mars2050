import { expect, test } from '@playwright/test'
import { collectNetwork, expectCanvasPainted } from './support/smoke-helpers'
import {
  collectConsoleWarnings,
  expectBattleReplayCanvasPainted,
  loadReplayPreset,
  startSelectedSimulation,
} from './support/replay-smoke-helpers'

test('production simulator2 first screen keeps replay and Pixi chunks deferred', async ({ page }) => {
  const network = collectNetwork(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()

  expect(network.hasChunk('BattleReplayModal')).toBe(false)
  expect(network.hasChunk('battle-replay-engine')).toBe(false)
  expect(network.hasChunk('pixi')).toBe(false)
  expect(network.countPathPrefix('/api/')).toBe(0)
  network.assertClean()
})

test('production simulator2 default Pixi replay paints after simulation starts', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const network = collectNetwork(page)
  const consoleWarnings = collectConsoleWarnings(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()
  await expect(page.getByLabel('Replay renderer')).toHaveValue('pixi')
  expect(network.hasChunk('pixi'), 'first simulator screen should not load Pixi').toBe(false)

  await loadReplayPreset(page, 'ranged_duel')
  await startSelectedSimulation(page)

  const canvas = page.locator('canvas').last()
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('data-replay-renderer', 'pixi')
  await page.waitForTimeout(900)
  await expectBattleReplayCanvasPainted(canvas)
  await expect(page.getByRole('button', { name: /Пауза|Играть/ })).toBeVisible()

  expect(network.countPathPrefix('/api/')).toBe(0)
  expect(consoleWarnings, 'console warnings').toEqual([])
  network.assertClean()
})

test('production simulator2 canvas fallback paints without loading Pixi', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const network = collectNetwork(page)
  const consoleWarnings = collectConsoleWarnings(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()
  expect(network.hasChunk('pixi'), 'first simulator screen should not load Pixi').toBe(false)

  await page.getByLabel('Replay renderer').selectOption('canvas')
  await loadReplayPreset(page, 'ranged_duel')
  await startSelectedSimulation(page)

  const canvas = page.locator('canvas').last()
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('data-replay-renderer', 'canvas')
  await page.waitForTimeout(900)
  await expectCanvasPainted(canvas)
  await expect(page.getByRole('button', { name: /Пауза|Играть/ })).toBeVisible()

  expect(network.hasChunk('pixi'), 'canvas fallback should not load Pixi').toBe(false)
  expect(network.countPathPrefix('/api/')).toBe(0)
  expect(consoleWarnings, 'console warnings').toEqual([])
  network.assertClean()
})
