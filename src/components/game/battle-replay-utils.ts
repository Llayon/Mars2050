import type { Container, Graphics } from 'pixi.js'

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function processVisualEffects(
  fts: { c: Container, life: number }[],
  projs: { g: Graphics, sX: number, sY: number, tX: number, tY: number, p: number, col: number }[],
  hazardFxs: { g: Graphics, life: number }[],
  dt: number
) {
  for (let i = fts.length - 1; i >= 0; i--) {
    const f = fts[i]
    f.life -= dt * 0.002; f.c.y -= dt * 0.02; f.c.alpha = f.life
    if (f.life <= 0) { f.c.destroy(); fts.splice(i, 1) }
  }
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i]
    p.p += dt * 0.005; p.g.x = lerp(p.sX, p.tX, p.p); p.g.y = lerp(p.sY, p.tY, p.p)
    if (p.p >= 1) { p.g.destroy(); projs.splice(i, 1) }
  }
  for (let i = hazardFxs.length - 1; i >= 0; i--) {
    const h = hazardFxs[i]
    h.life -= dt * 0.0003
    h.g.alpha = h.life * 0.5
    if (h.life <= 0) { h.g.destroy(); hazardFxs.splice(i, 1) }
  }
}
