import { beforeEach, describe, expect, it } from 'vitest'
import { resolveReplayRendererMode } from '@/components/game/battle-replay-engine'

function installLocalStorage() {
  const values = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    },
  })
}

describe('battle replay engine renderer mode', () => {
  beforeEach(() => {
    installLocalStorage()
  })

  it('prefers explicit renderer mode over local storage', () => {
    window.localStorage.setItem('mars2050:replay-renderer', 'pixi')

    expect(resolveReplayRendererMode('canvas')).toBe('canvas')
    expect(resolveReplayRendererMode('pixi')).toBe('pixi')
  })

  it('uses local storage opt-in when no explicit mode is provided', () => {
    window.localStorage.setItem('mars2050:replay-renderer', 'pixi')

    expect(resolveReplayRendererMode()).toBe('pixi')
  })

  it('falls back to canvas for missing or unknown stored values', () => {
    window.localStorage.removeItem('mars2050:replay-renderer')
    expect(resolveReplayRendererMode()).toBe('canvas')

    window.localStorage.setItem('mars2050:replay-renderer', 'webgl')
    expect(resolveReplayRendererMode()).toBe('canvas')
  })
})
