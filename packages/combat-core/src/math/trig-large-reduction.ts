// Adapted from fdlibm / V8 ieee754 (Chromium 138.0.7204.174).
// Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
// Developed at SunSoft, a Sun Microsystems, Inc. business.
// Permission to use, copy, modify, and distribute this software is freely
// granted, provided that this notice is preserved.
// Modified significantly by Google Inc. Copyright 2016 the V8 project authors.
import { PIO2_CHUNKS, TWO_OVER_PI } from './trig-reduction-constants.js'

/** Payne-Hanek reduction, specialized to fdlibm's extended-precision path. */
export function reduceLargeAngle(x: number[], exponent: number): [number, number, number] {
  const two24 = 16777216
  const inverse24 = 5.9604644775390625e-8
  const jk = 4
  const jx = x.length - 1
  const jv = Math.max(0, Math.trunc((exponent - 3) / 24))
  let q0 = exponent - 24 * (jv + 1)
  const f: number[] = []
  const q: number[] = []
  const iq: number[] = []
  const fq: number[] = []
  for (let i = 0; i <= jx + jk; i++) f[i] = jv - jx + i < 0 ? 0 : TWO_OVER_PI[jv - jx + i]
  const computeTerm = (i: number): number => {
    let sum = 0
    for (let j = 0; j <= jx; j++) sum += x[j] * f[jx + i - j]
    return sum
  }
  for (let i = 0; i <= jk; i++) q[i] = computeTerm(i)
  let jz = jk
  let n = 0
  let ih = 0
  let z = 0
  for (;;) {
    z = q[jz]
    for (let i = 0, j = jz; j > 0; i++, j--) {
      const carry = Math.trunc(inverse24 * z)
      iq[i] = Math.trunc(z - two24 * carry)
      z = q[j - 1] + carry
    }
    z *= 2 ** q0
    z -= 8 * Math.floor(z * 0.125)
    n = Math.trunc(z)
    z -= n
    ih = 0
    if (q0 > 0) {
      const high = iq[jz - 1] >> (24 - q0)
      n += high
      iq[jz - 1] -= high << (24 - q0)
      ih = iq[jz - 1] >> (23 - q0)
    } else if (q0 === 0) ih = iq[jz - 1] >> 23
    else if (z >= 0.5) ih = 2
    if (ih > 0) {
      n++
      let carry = 0
      for (let i = 0; i < jz; i++) {
        if (carry === 0) {
          if (iq[i] !== 0) { carry = 1; iq[i] = 0x1000000 - iq[i] }
        } else iq[i] = 0xffffff - iq[i]
      }
      if (q0 === 1) iq[jz - 1] &= 0x7fffff
      if (q0 === 2) iq[jz - 1] &= 0x3fffff
      if (ih === 2) {
        z = 1 - z
        if (carry !== 0) z -= 2 ** q0
      }
    }
    if (z !== 0) break
    let nonzero = 0
    for (let i = jz - 1; i >= jk; i--) nonzero |= iq[i]
    if (nonzero !== 0) break
    let extra = 1
    while (extra <= jk && iq[jk - extra] === 0) extra++
    for (let i = jz + 1; i <= jz + extra; i++) {
      f[jx + i] = TWO_OVER_PI[jv + i]
      q[i] = computeTerm(i)
    }
    jz += extra
  }
  if (z === 0) {
    jz--
    q0 -= 24
    while (iq[jz] === 0) { jz--; q0 -= 24 }
  } else {
    z *= 2 ** -q0
    if (z >= two24) {
      const carry = Math.trunc(inverse24 * z)
      iq[jz] = z - two24 * carry
      jz++
      q0 += 24
      iq[jz] = carry
    } else iq[jz] = z
  }
  let scale = 2 ** q0
  for (let i = jz; i >= 0; i--) { q[i] = scale * iq[i]; scale *= inverse24 }
  for (let i = jz; i >= 0; i--) {
    let sum = 0
    for (let k = 0; k <= jk && k <= jz - i; k++) sum += PIO2_CHUNKS[k] * q[i + k]
    fq[jz - i] = sum
  }
  let head = 0
  for (let i = jz; i >= 0; i--) head += fq[i]
  let tail = fq[0] - head
  for (let i = 1; i <= jz; i++) tail += fq[i]
  return [n & 7, ih === 0 ? head : -head, ih === 0 ? tail : -tail]
}
