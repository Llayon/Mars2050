import type { BattleReplayMetrics } from './battle-replay-metrics'

interface BattleReplayDebugMetricsProps {
  metrics: BattleReplayMetrics
  showOverlap: boolean
}

export function BattleReplayDebugMetrics({
  metrics,
  showOverlap,
}: BattleReplayDebugMetricsProps) {
  const format = (value: number, digits: number) => value.toFixed(digits)
  return (
    <div className="flex w-64 flex-col gap-2 rounded-lg border border-gray-600 bg-gray-800/95 p-3 text-sm shadow-lg">
      <div className="mb-1 border-b border-gray-700 pb-1 font-bold text-gray-200">
        Метрики (Tick {metrics.totalTicks})
      </div>
      <Metric label="Первая атака" value={metrics.firstAttack >= 0 ? `Tick ${metrics.firstAttack}` : 'Нет'} />
      {metrics.mark.firstMarkTick !== null && (
        <>
          <Metric label="Первая метка" value={`Tick ${metrics.mark.firstMarkTick}`} />
          <Metric label="Uptime метки" value={`${metrics.mark.markUptimeTicks} ticks`} />
          <Metric label="Отмечено отрядов" value={metrics.mark.uniqueMarkedSquads} />
          <Metric label="Использование" value={`${format(metrics.mark.markUtilization * 100, 1)}%`} />
          <Metric label="Выстрелы по метке" value={`${metrics.mark.shotsAgainstMarkedTargets}/${metrics.mark.alliedShotsWhileMarkActive}`} />
          <Metric label="Бонусный урон" value={metrics.mark.bonusDamageFromMarks} />
          <Metric label="Retarget / refresh" value={`${metrics.mark.alliesRetargetedByMark}/${metrics.mark.markRefreshCount}`} />
        </>
      )}
      {showOverlap && (
        <>
          <Metric label="Avg Overlap" value={`${format(metrics.averageOverlap, 1)}px`} />
          <Metric label="Max Overlap" value={`${format(metrics.maxOverlap, 1)}px`} />
          <Metric label="Avg Ratio" value={format(metrics.averageOverlapRatio, 2)} />
          <Metric label="Max Ratio" value={format(metrics.maxOverlapRatio, 2)} />
          <Metric label="Severe Samples" value={`${metrics.severeOverlapSamples}/${metrics.overlapSamples}`} />
        </>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-2 text-gray-300">
      <span>{label}:</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
