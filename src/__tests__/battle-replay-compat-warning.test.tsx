import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const startBattleReplayEngineMock = vi.fn().mockResolvedValue({
  controls: null,
  cleanupEvents: null,
})

vi.mock('@/components/game/battle-replay-engine', () => ({
  startBattleReplayEngine: (...args: unknown[]) => startBattleReplayEngineMock(...args),
}))

import { BattleReplayModal } from '@/components/game/BattleReplayModal'

function installMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches,
      media: '(min-width: 1024px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

describe('BattleReplayModal UI', () => {
  beforeEach(() => {
    startBattleReplayEngineMock.mockClear()
    installMatchMedia(false)
  })

  it('keeps the approximation warning visible while replay is open', async () => {
    render(
      <BattleReplayModal
        attackerUnits={[]}
        defenderUnits={[]}
        logs={[]}
        replayWarning="Исторический реплей v2: визуализация приблизительная."
        onClose={() => undefined}
      />
    )

    expect(screen.getByRole('status').textContent).toContain('реплей v2')
    await waitFor(() => expect(startBattleReplayEngineMock).toHaveBeenCalledOnce())
  })

  it('keeps mobile replay controls compact and omits diagnostics', () => {
    render(
      <BattleReplayModal
        attackerUnits={[]}
        defenderUnits={[]}
        logs={[]}
        onClose={() => undefined}
      />
    )

    expect(screen.getByText('Таймлайн')).toBeTruthy()
    expect(screen.queryByText(/Метрики/)).toBeNull()
    expect(screen.queryByText('Оверлеи (Debug)')).toBeNull()
  })

  it('shows metrics and debug overlays on desktop', async () => {
    installMatchMedia(true)
    render(
      <BattleReplayModal
        attackerUnits={[]}
        defenderUnits={[]}
        logs={[]}
        onClose={() => undefined}
      />
    )

    expect(await screen.findByText(/Метрики/)).toBeTruthy()
    expect(screen.getByText('Оверлеи (Debug)')).toBeTruthy()
  })
})
