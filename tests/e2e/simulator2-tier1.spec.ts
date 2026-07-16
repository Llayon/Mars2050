import { expect, test } from '@playwright/test'

test('simulator2 enforces the focused Tier 1 command-point flow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const browserErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', error => browserErrors.push(error.message))

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()

  const attacker = page.locator('section').filter({ hasText: 'Команда: Атака' })
  const defender = page.locator('section').filter({ hasText: 'Команда: Защита' })
  const startButton = page.getByRole('button', { name: /НАЧАТЬ СИМУЛЯЦИЮ/ })

  await expect(page.getByText('Первый тир', { exact: true })).toHaveCount(2)
  await expect(page.getByText('0 / 6 ОК', { exact: true })).toHaveCount(2)
  await expect(page.getByText('Глобальные способности', { exact: true })).toHaveCount(0)
  expect(await attacker.getByRole('button', { name: /^\+ / }).count()).toBe(12)
  expect(await defender.getByRole('button', { name: /^\+ / }).count()).toBe(12)
  await expect(startButton).toBeDisabled()

  await attacker.getByRole('button', { name: '+ Морпех', exact: true }).click()
  await expect(attacker.getByText('1 / 6 ОК', { exact: true })).toBeVisible()
  await expect(attacker.getByText('Морпех [90, 930]', { exact: true })).toBeVisible()
  await expect(startButton).toBeDisabled()
  await expect(page.getByText(/Добавьте хотя бы по одному отряду/)).toBeVisible()

  await defender.getByRole('button', { name: '+ Морпех', exact: true }).click()
  await expect(defender.getByText('1 / 6 ОК', { exact: true })).toBeVisible()
  await expect(defender.getByText('Морпех [210, 270]', { exact: true })).toBeVisible()
  await expect(startButton).toBeEnabled()

  await startButton.click()
  const replayCanvas = page.locator('canvas').last()
  await expect(replayCanvas).toBeVisible()
  await page.getByRole('button', { name: /✕/ }).click()
  await expect(replayCanvas).toBeHidden()

  await page.getByRole('button', { name: 'QA', exact: true }).click()
  await expect(page.getByText('Глобальные способности', { exact: true })).toHaveCount(2)
  await expect(page.getByText('Тир 2 (Средняя техника)', { exact: true })).toHaveCount(2)
  await expect(page.getByText(/\/ 6 ОК/)).toHaveCount(0)
  await expect(startButton).toBeDisabled()
  expect(browserErrors).toEqual([])
})

test('Tier 1 setup stays usable on a mobile viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/simulator2')

  const attacker = page.locator('section').filter({ hasText: 'Команда: Атака' })
  const defender = page.locator('section').filter({ hasText: 'Команда: Защита' })
  await attacker.getByRole('button', { name: '+ Морпех', exact: true }).click()
  await defender.getByRole('button', { name: '+ Морпех', exact: true }).click()

  await expect(page.getByRole('button', { name: /НАЧАТЬ СИМУЛЯЦИЮ/ })).toBeEnabled()
  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }))
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1)
  await page.screenshot({ path: testInfo.outputPath('tier1-mobile.png'), fullPage: true })
})

test('Tier 1 setup rejects manual deployment inside a crater', async ({ page }) => {
  await page.goto('/simulator2')
  const attacker = page.locator('section').filter({ hasText: 'Команда: Атака' })
  const defender = page.locator('section').filter({ hasText: 'Команда: Защита' })
  const startButton = page.getByRole('button', { name: /НАЧАТЬ СИМУЛЯЦИЮ/ })
  await attacker.getByRole('button', { name: '+ Морпех', exact: true }).click()
  await defender.getByRole('button', { name: '+ Морпех', exact: true }).click()

  await defender.getByRole('spinbutton', { name: 'Морпех X' }).fill('270')
  await defender.getByRole('spinbutton', { name: 'Морпех Y' }).fill('570')
  await expect(page.getByText(/Расстановка пересекается с препятствием/)).toBeVisible()
  await expect(startButton).toBeDisabled()

  await defender.getByRole('spinbutton', { name: 'Морпех X' }).fill('510')
  await expect(page.getByText(/Расстановка пересекается с препятствием/)).toBeHidden()
  await expect(startButton).toBeEnabled()
})

test('five marine squads plus a scout resolve the six-marine baseline', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/simulator2')

  const attacker = page.locator('section').filter({ hasText: 'Команда: Атака' })
  const defender = page.locator('section').filter({ hasText: 'Команда: Защита' })
  for (let index = 0; index < 5; index++) {
    await attacker.getByRole('button', { name: '+ Морпех', exact: true }).click()
  }
  await attacker.getByRole('button', { name: '+ Развед-дрон', exact: true }).click()
  for (let index = 0; index < 6; index++) {
    await defender.getByRole('button', { name: '+ Морпех', exact: true }).click()
  }

  await expect(attacker.getByText('6 / 6 ОК', { exact: true })).toBeVisible()
  await expect(defender.getByText('6 / 6 ОК', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /НАЧАТЬ СИМУЛЯЦИЮ/ }).click()

  const timeline = page.getByTestId('replay-timeline')
  await expect(timeline).toBeVisible()
  const maxTick = Number(await timeline.getAttribute('max'))
  expect(maxTick).toBeGreaterThan(50)
  expect(maxTick).toBeLessThan(200)
})
