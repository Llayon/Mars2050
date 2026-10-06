// Adapted from fdlibm / V8 ieee754 (Chromium 138.0.7204.174).
// Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
// Developed at SunSoft, a Sun Microsystems, Inc. business.
// Permission to use, copy, modify, and distribute this software is freely
// granted, provided that this notice is preserved.
// Modified significantly by Google Inc. Copyright 2016 the V8 project authors.
import { highWord, replaceHighWord } from './trig-bits.js'
import { MULTIPLE_HIGH_WORDS } from './trig-reduction-constants.js'
import { reduceLargeAngle } from './trig-large-reduction.js'

const PIO2_1 = 1.57079632673412561417
const PIO2_1T = 6.07710050650619224932e-11
const PIO2_2 = 6.07710050630396597660e-11
const PIO2_2T = 2.02226624879595063154e-21
const PIO2_3 = 2.02226624871116645580e-21
const PIO2_3T = 8.47842766036889956997e-32

/** Returns quadrant and a two-double remainder, without native trigonometry. */
export function reduceAngle(value: number): [number, number, number] {
  const x = Math.abs(value)
  const ix = highWord(x)
  const sign = value < 0 ? -1 : 1
  if (ix < 0x4002d97c) {
    let z = x - PIO2_1
    const tail = ix !== 0x3ff921fb ? PIO2_1T : PIO2_2T
    if (ix === 0x3ff921fb) z -= PIO2_2
    const head = z - tail
    return [sign, sign * head, sign * ((z - head) - tail)]
  }
  if (ix <= 0x413921fb) {
    const n = Math.trunc(x * 6.36619772367581382433e-1 + 0.5)
    let r = x - n * PIO2_1
    let w = n * PIO2_1T
    let head = r - w
    if (n >= 32 || ix === MULTIPLE_HIGH_WORDS[n - 1]) {
      const exponent = ix >>> 20
      if (exponent - ((highWord(head) >>> 20) & 0x7ff) > 16) {
        const t = r
        w = n * PIO2_2
        r = t - w
        w = n * PIO2_2T - ((t - r) - w)
        head = r - w
        if (exponent - ((highWord(head) >>> 20) & 0x7ff) > 49) {
          const t2 = r
          w = n * PIO2_3
          r = t2 - w
          w = n * PIO2_3T - ((t2 - r) - w)
          head = r - w
        }
      }
    }
    return [sign * n, sign * head, sign * ((r - head) - w)]
  }
  const exponent = (ix >>> 20) - 1046
  let z = replaceHighWord(x, ix - (exponent << 20))
  const pieces: number[] = []
  for (let i = 0; i < 2; i++) {
    pieces.push(Math.trunc(z))
    z = (z - pieces[i]) * 16777216
  }
  pieces.push(z)
  while (pieces.at(-1) === 0) pieces.pop()
  const [n, head, tail] = reduceLargeAngle(pieces, exponent)
  return [sign * n, sign * head, sign * tail]
}
