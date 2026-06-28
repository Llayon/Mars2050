'use client'

import { memo } from 'react'

export const ProductionOverview = memo(function ProductionOverview() {
  return (
    <div className="bg-black/30 border border-white/10 rounded-xl p-4 overflow-x-auto custom-scrollbar text-sm">
      <h3 className="text-gray-400 font-semibold mb-4 uppercase tracking-wider">Производственные цепочки</h3>
      <div className="min-w-[400px]">
        <div className="flex flex-col gap-2 font-mono text-gray-300 whitespace-pre">
          <div>{'⛏️ minerals ─────┬──→ 📦 consumer_goods (workshop)'}</div>
          <div>{'                 │'}</div>
          <div>{'⚡ energy ──┬────┼──→ 💾 databanks (data_center)'}</div>
          <div>{'            │    │'}</div>
          <div>{'            │    └──→ 🔩 nanomaterials (nanoforge)'}</div>
          <div>{'            │'}</div>
          <div>{'💧 water ───┴───────→ 🌾 food (greenhouse)'}</div>
          <div>{''}</div>
          <div>{'🏭 Дополнительно:'}</div>
          <div>{'🪨 regolith ───────→ 🧪 research_points (biotech_lab)'}</div>
        </div>
      </div>
    </div>
  )
})
