import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: 0,
    })
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
    expect(screen.queryByText('Управление')).toBeNull()
    expect(screen.queryByText(/Метрики/)).toBeNull()
    expect(screen.queryByText('Оверлеи (Debug)')).toBeNull()
  })

  it('keeps diagnostics hidden for a touch device with a desktop-sized viewport', async () => {
    installMatchMedia(true)
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: 5,
    })
    render(
      <BattleReplayModal
        attackerUnits={[]}
        defenderUnits={[]}
        logs={[]}
        onClose={() => undefined}
      />
    )

    await waitFor(() => expect(window.matchMedia).toHaveBeenCalledWith(
      '(min-width: 1024px) and (hover: hover) and (pointer: fine)',
    ))
    expect(screen.queryByText('Управление')).toBeNull()
    expect(screen.queryByText(/Метрики/)).toBeNull()
    expect(screen.queryByText('Оверлеи (Debug)')).toBeNull()
  })

  it('pauses the replay runtime synchronously from the playback control', async () => {
    const pause = vi.fn()
    startBattleReplayEngineMock.mockResolvedValueOnce({
      controls: {
        play: vi.fn(),
        pause,
        seekToTick: vi.fn(),
        getCurrentTick: vi.fn().mockReturnValue(0),
        getTotalTicks: vi.fn().mockReturnValue(0),
        setSpeed: vi.fn(),
        setOverlays: vi.fn(),
      },
      cleanupEvents: null,
    })
    render(
      <BattleReplayModal
        attackerUnits={[]}
        defenderUnits={[]}
        logs={[]}
        onClose={() => undefined}
      />
    )

    await waitFor(() => expect(startBattleReplayEngineMock).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: /Пауза/ }))
    expect(pause).toHaveBeenCalledOnce()
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
