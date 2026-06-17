'use client'

import { useEffect, useRef, memo } from 'react'
import { Application, Graphics, Text, Container } from 'pixi.js'
import type { BattleTick } from '@/domains/combat/combat.engine'
import type { UnitRow } from '@/domains/combat/combat.types'

interface BattleReplayModalProps {
  attackerUnits: UnitRow[]
  defenderUnits: UnitRow[]
  logs: BattleTick[]
  onClose: () => void
}

export const BattleReplayModal = memo(function BattleReplayModal({ 
  attackerUnits, 
  defenderUnits, 
  logs, 
  onClose 
}: BattleReplayModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let app: Application
    let isDestroyed = false

    async function initPixi() {
      app = new Application()
      await app.init({ width: 780, height: 440, backgroundColor: 0x111111 })
      
      if (isDestroyed) return
      
      if (containerRef.current) {
        containerRef.current.appendChild(app.canvas)
      }
      
      // Draw grid (7x4)
      const TILE_W = 100
      const TILE_H = 100
      const OFFSET_X = 40
      const OFFSET_Y = 20

      const gridContainer = new Container()
      app.stage.addChild(gridContainer)

      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 7; x++) {
          const tile = new Graphics()
          tile.rect(OFFSET_X + x * TILE_W, OFFSET_Y + y * TILE_H, TILE_W - 2, TILE_H - 2)
          tile.fill({ color: 0x222222 })
          gridContainer.addChild(tile)
        }
      }

      // Initialize units
      const unitSprites: Record<string, { container: Container, bg: Graphics, text: Text, hpText: Text, hp: number }> = {}

      function createUnit(u: UnitRow, team: 'attacker' | 'defender') {
        const c = new Container()
        const gridX = u.grid_x !== null && u.grid_x !== undefined ? u.grid_x : (team === 'attacker' ? 0 : 6)
        const gridY = u.grid_y !== null && u.grid_y !== undefined ? u.grid_y : 0
        c.x = OFFSET_X + Number(gridX) * TILE_W
        c.y = OFFSET_Y + Number(gridY) * TILE_H
        
        const bg = new Graphics()
        bg.circle(TILE_W/2, TILE_H/2, 30)
        bg.fill({ color: team === 'attacker' ? 0x3b82f6 : 0xef4444 }) // blue-500 : red-500
        c.addChild(bg)

        const text = new Text({ text: u.unit_type.substring(0,2).toUpperCase(), style: { fill: 0xffffff, fontSize: 16 } })
        text.anchor.set(0.5)
        text.position.set(TILE_W/2, TILE_H/2)
        c.addChild(text)

        const hpText = new Text({ text: String(u.hp_current), style: { fill: 0x4ade80, fontSize: 12 } }) // green-400
        hpText.anchor.set(0.5)
        hpText.position.set(TILE_W/2, TILE_H/2 + 20)
        c.addChild(hpText)

        app.stage.addChild(c)

        if (!u.id) return
        unitSprites[u.id] = { container: c, bg, text, hpText, hp: u.hp_current }
      }

      attackerUnits.forEach(u => createUnit(u, 'attacker'))
      defenderUnits.forEach(u => createUnit(u, 'defender'))

      // Simple animation loop
      let currentTick = 0
      let timeAccumulator = 0
      const TICK_DURATION = 800 // ms per tick (slower for better visibility)

      app.ticker.add((ticker) => {
        timeAccumulator += ticker.deltaMS
        
        if (timeAccumulator >= TICK_DURATION) {
          timeAccumulator -= TICK_DURATION
          
          if (currentTick < logs.length) {
            const tickData = logs[currentTick]
            
            // Process actions immediately for this tick
            tickData.actions.forEach(action => {
              const sprite = unitSprites[action.unitId]
              if (!sprite) return

              if (action.type === 'move' && action.toX !== undefined && action.toY !== undefined) {
                // Instantly move to new tile
                sprite.container.x = OFFSET_X + action.toX * TILE_W
                sprite.container.y = OFFSET_Y + action.toY * TILE_H
              } else if (action.type === 'attack') {
                // Highlight attacker briefly
                sprite.bg.clear().circle(TILE_W/2, TILE_H/2, 35).fill({ color: 0xffffff })
                setTimeout(() => {
                  if (sprite && !sprite.container.destroyed) {
                    sprite.bg.clear().circle(TILE_W/2, TILE_H/2, 30).fill({ color: attackerUnits.some(u => u.id === action.unitId) ? 0x3b82f6 : 0xef4444 })
                  }
                }, 300)

                // Update target HP
                if (action.targetId && action.damage) {
                  const target = unitSprites[action.targetId]
                  if (target) {
                    target.hp -= action.damage
                    target.hpText.text = Math.max(0, target.hp).toString()
                    
                    // Flash target red
                    target.bg.clear().circle(TILE_W/2, TILE_H/2, 30).fill({ color: 0xffaaaa })
                    setTimeout(() => {
                      if (target && !target.container.destroyed && target.hp > 0) {
                        target.bg.clear().circle(TILE_W/2, TILE_H/2, 30).fill({ color: attackerUnits.some(u => u.id === action.targetId) ? 0x3b82f6 : 0xef4444 })
                      }
                    }, 200)
                  }
                }
              } else if (action.type === 'die') {
                sprite.container.alpha = 0.3
                sprite.bg.clear().circle(TILE_W/2, TILE_H/2, 30).fill({ color: 0x444444 })
                sprite.hpText.text = 'DEAD'
                sprite.hpText.style.fill = 0xff5555
              }
            })

            currentTick++
          }
        }
      })
    }

    initPixi()

    return () => {
      isDestroyed = true
      if (app) {
        app.destroy(true, { children: true, texture: true, context: true })
      }
    }
  }, [attackerUnits, defenderUnits, logs])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-800 p-4 rounded-xl shadow-2xl border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Реплей Боя</h2>
            <p className="text-xs text-gray-400">Синие — твои войска, Красные — враг</p>
          </div>
          <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-white text-sm">Закрыть</button>
        </div>
        <div ref={containerRef} className="rounded-lg overflow-hidden border border-gray-900" />
      </div>
    </div>
  )
})
