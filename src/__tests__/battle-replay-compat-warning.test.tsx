import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const startBattleReplayEngineMock = vi.fn().mockResolvedValue({
  controls: null,
  cleanupEvents: null,
})

vi.mock('@/components/game/battle-replay-engine', () => ({
  startBattleReplayEngine: (...args: unknown[]) => startBattleReplayEngineMock(...args),
}))

import { BattleReplayModal } from '@/components/game/BattleReplayModal'

describe('BattleReplayModal legacy compatibility warning', () => {
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
})
