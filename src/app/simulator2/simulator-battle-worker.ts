import { simulateBattle } from '@/domains/combat/combat.engine'
import type {
  SimulatorBattleWorkerRequest,
  SimulatorBattleWorkerResponse,
} from './simulator-battle-worker.types'

interface SimulatorWorkerScope {
  onmessage: ((event: MessageEvent<SimulatorBattleWorkerRequest>) => void) | null
  postMessage: (message: SimulatorBattleWorkerResponse) => void
}

const workerScope = self as unknown as SimulatorWorkerScope

workerScope.onmessage = event => {
  try {
    const request = event.data
    const result = simulateBattle(
      request.attackerUnits,
      request.defenderUnits,
      request.seed,
      request.obstacles,
      request.attackerGlobals,
      request.defenderGlobals,
      { maxTicks: 400, timeoutPolicy: 'draw' },
    )
    workerScope.postMessage({ ok: true, result })
  } catch (error) {
    workerScope.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : 'Combat worker failed.',
    })
  }
}
