import { highWord } from './trig-bits.js'
import { kernelCos, kernelSin } from './trig-kernels.js'
import { reduceAngle } from './trig-reduction.js'

/** Stable fdlibm sine: never calls the host runtime's implementation. */
export function deterministicSin(x: number): number {
  const ix = highWord(x) & 0x7fffffff
  if (ix <= 0x3fe921fb) return kernelSin(x, 0, false)
  if (ix >= 0x7ff00000) return Number.NaN
  const [n, head, tail] = reduceAngle(x)
  switch (n & 3) {
    case 0: return kernelSin(head, tail, true)
    case 1: return kernelCos(head, tail)
    case 2: return -kernelSin(head, tail, true)
    default: return -kernelCos(head, tail)
  }
}

/** Stable fdlibm cosine; preserves the existing Node Mars baseline. */
export function deterministicCos(x: number): number {
  const ix = highWord(x) & 0x7fffffff
  if (ix <= 0x3fe921fb) return kernelCos(x, 0)
  if (ix >= 0x7ff00000) return Number.NaN
  const [n, head, tail] = reduceAngle(x)
  switch (n & 3) {
    case 0: return kernelCos(head, tail)
    case 1: return -kernelSin(head, tail, true)
    case 2: return -kernelCos(head, tail)
    default: return kernelSin(head, tail, true)
  }
}
