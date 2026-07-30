import type { BattleResult } from '@/domains/combat/combat.actions'
import type {
  SimulatorBattleWorkerRequest,
  SimulatorBattleWorkerResponse,
} from './simulator-battle-worker.types'

export function simulateBattleOffThread(
  request: SimulatorBattleWorkerRequest,
): Promise<BattleResult> {
  if (typeof Worker === 'undefined') return simulateOnMainThread(request)

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./simulator-battle-worker.ts', import.meta.url),
      { type: 'module' },
    )
    worker.onmessage = (event: MessageEvent<SimulatorBattleWorkerResponse>) => {
      worker.terminate()
      if (event.data.ok) resolve(event.data.result)
      else reject(new Error(event.data.error))
    }
    worker.onerror = event => {
      worker.terminate()
      reject(new Error(event.message || 'Combat worker failed.'))
    }
    worker.onmessageerror = () => {
      worker.terminate()
      reject(new Error('Combat worker returned an unreadable result.'))
    }
    worker.postMessage(request)
  })
}

async function simulateOnMainThread(
  request: SimulatorBattleWorkerRequest,
): Promise<BattleResult> {
  const { simulateBattle } = await import('@/domains/combat/combat.engine')
  return simulateBattle(
    request.attackerUnits,
    request.defenderUnits,
    request.seed,
    request.obstacles,
    request.attackerGlobals,
    request.defenderGlobals,
    { maxTicks: 400, timeoutPolicy: 'draw' },
  )
}
