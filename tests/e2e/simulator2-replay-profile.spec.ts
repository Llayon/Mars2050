import { expect, test, type Page } from '@playwright/test'

interface ProfileSnapshot {
  version: number
  renderer: string
  sampling: { sampleCount: number }
  timings: {
    unitSyncMs: { p95: number }
    totalCpuMs: { p95: number }
  }
  counters: {
    visibleUnitUpdates: number
    fallbackRebuilds: number
    hpRebuilds: number
    flashRebuilds: number
    hitboxRebuilds: number
    velocityRebuilds: number
  }
  lastFrameCounters: {
    fallbackRebuilds: number
    hpRebuilds: number
    flashRebuilds: number
    hitboxRebuilds: number
    velocityRebuilds: number
  }
}

const cases = [
  { name: 'desktop-ranged', width: 1440, height: 1100, preset: 'ranged_duel', mobile: false },
  { name: 'desktop-crowd', width: 1440, height: 1100, preset: 'marine_crowd_qa', mobile: false },
  { name: 'desktop-zerg', width: 1440, height: 1100, preset: 'zerg_rush', mobile: false },
  { name: 'mobile-ranged', width: 390, height: 844, preset: 'ranged_duel', mobile: true },
  { name: 'mobile-crowd', width: 390, height: 844, preset: 'marine_crowd_qa', mobile: true },
  { name: 'mobile-zerg', width: 390, height: 844, preset: 'zerg_rush', mobile: true },
]

test('hidden Pixi profiler exports bounded render measurements', async ({ browser }) => {
  for (const profileCase of cases) {
    const context = await browser.newContext({
      viewport: { width: profileCase.width, height: profileCase.height },
      hasTouch: profileCase.mobile,
      isMobile: profileCase.mobile,
    })
    const page = await context.newPage()
    try {
      await page.goto('/simulator2?replayProfile=1')
      await expect(page.getByRole('heading', { name: /Симулятор Боя/ }))
        .toBeVisible()
      await page.getByLabel('Replay renderer').selectOption('pixi')
      await loadReplayPreset(page, profileCase.preset)
      await page.getByRole('button', { name: /НАЧАТЬ СИМУЛЯЦИЮ/ }).click()

      const canvas = page.locator('canvas').last()
      await expect(canvas).toHaveAttribute('data-replay-renderer', 'pixi')
      await page.waitForTimeout(3000)
      const snapshot = await requestProfile(page)

      expect(snapshot).toMatchObject({ version: 1, renderer: 'pixi' })
      expect(snapshot.sampling.sampleCount).toBeGreaterThan(0)
      expect(snapshot.counters.visibleUnitUpdates).toBeGreaterThan(0)
      if (process.env.REPLAY_PROFILE_LOG === '1') {
        console.log(
          `REPLAY_PROFILE ${profileCase.name} ${JSON.stringify(snapshot)}`,
        )
      }

      await page.getByRole('button', { name: /Пауза/ }).click()
      await page.waitForTimeout(150)
      const paused = await requestProfile(page)
      expect(paused.lastFrameCounters).toMatchObject({
        fallbackRebuilds: 0,
        hpRebuilds: 0,
        flashRebuilds: 0,
        hitboxRebuilds: 0,
        velocityRebuilds: 0,
      })
    } finally {
      await context.close()
    }
  }
})

async function loadReplayPreset(page: Page, preset: string): Promise<void> {
  const presetSelect = page.locator('select').first()
  await presetSelect.evaluate((element, value) => {
    const input = element as HTMLSelectElement
    const setter =
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
    setter?.call(input, '')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, preset)
  await expect(presetSelect).toHaveValue(preset)
}

async function requestProfile(page: Page): Promise<ProfileSnapshot> {
  const canvas = page.locator('canvas').last()
  await canvas.evaluate(element => {
    delete (element as HTMLCanvasElement).dataset.replayProfileJson
    element.dispatchEvent(
      new CustomEvent('mars2050:replay-profile-request'),
    )
  })
  await expect(canvas).toHaveAttribute('data-replay-profile-json', /"version":1/)
  return JSON.parse(
    await canvas.getAttribute('data-replay-profile-json') ?? '{}',
  ) as ProfileSnapshot
}
