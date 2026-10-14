// Adapted from fdlibm (Sun Microsystems / Netlib).
// Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
// Developed at SunSoft, a Sun Microsystems, Inc. business.
// Permission to use, copy, modify, and distribute this software is freely granted.
import { highWord, lowWord } from './trig-bits.js'

const atanhi = [
  4.63647609000806093515e-01, // 0x3FDDAC67, 0x0561BB4F
  7.85398163397448278999e-01, // 0x3FE921FB, 0x54442D18
  9.82793723247329054082e-01, // 0x3FEF730B, 0xD281F69B
  1.57079632679489655800e+00, // 0x3FF921FB, 0x54442D18
]

const atanlo = [
  2.26987774529616870924e-17, // 0x3C7A2B7F, 0x222F65E2
  3.06161699786838301793e-17, // 0x3C81A626, 0x33145C07
  1.39033110312309984516e-17, // 0x3C700788, 0x7AF0CBBD
  6.12323399573676603587e-17, // 0x3C91A626, 0x33145C07
]

const aT = [
  3.33333333333329318027e-01,
 -1.99999999998764832476e-01,
  1.42857142725034663711e-01,
 -1.11111104054623557880e-01,
  9.09088713343650656196e-02,
 -7.69187620504482999495e-02,
  6.66107313738753120669e-02,
 -5.83357013379057348645e-02,
  4.97687799461593236017e-02,
 -3.65315727442169155270e-02,
  1.62858201153657823623e-02,
]

const one = 1.0
const huge = 1.0e300
const pi_o_4 = 7.8539816339744827900e-01
const pi_o_2 = 1.5707963267948965580e+00
const pi = 3.1415926535897931160e+00
const pi_lo = 1.2246467991473531772e-16

/** Stable fdlibm arctangent; never calls host Math.atan. */
export function deterministicAtan(x: number): number {
  const hx = highWord(x)
  const ix = hx & 0x7fffffff
  const isNeg = (hx & 0x80000000) !== 0
  if (ix >= 0x44100000) {
    if (ix > 0x7ff00000 || (ix === 0x7ff00000 && lowWord(x) !== 0)) return x + x
    return !isNeg ? atanhi[3] + atanlo[3] : -atanhi[3] - atanlo[3]
  }
  let id = -1
  let reducedX = x
  if (ix < 0x3fdc0000) {
    if (ix < 0x3e200000) {
      if (huge + x > one) return x
    }
  } else {
    reducedX = Math.abs(x)
    if (ix < 0x3ff30000) {
      if (ix < 0x3fe60000) {
        id = 0
        reducedX = (2.0 * reducedX - one) / (2.0 + reducedX)
      } else {
        id = 1
        reducedX = (reducedX - one) / (reducedX + one)
      }
    } else {
      if (ix < 0x40038000) {
        id = 2
        reducedX = (reducedX - 1.5) / (one + 1.5 * reducedX)
      } else {
        id = 3
        reducedX = -1.0 / reducedX
      }
    }
  }
  const z = reducedX * reducedX
  const w = z * z
  const s1 = z * (aT[0] + w * (aT[2] + w * (aT[4] + w * (aT[6] + w * (aT[8] + w * aT[10])))))
  const s2 = w * (aT[1] + w * (aT[3] + w * (aT[5] + w * (aT[7] + w * aT[9]))))
  if (id < 0) return reducedX - reducedX * (s1 + s2)
  const zRes = atanhi[id] - ((reducedX * (s1 + s2) - atanlo[id]) - reducedX)
  return isNeg ? -zRes : zRes
}

/** Stable fdlibm atan2: cross-platform bitwise identical arctangent of y/x. */
export function deterministicAtan2(y: number, x: number): number {
  const hx = highWord(x)
  const ix = hx & 0x7fffffff
  const lx = lowWord(x)
  const hy = highWord(y)
  const iy = hy & 0x7fffffff
  const ly = lowWord(y)

  if (ix > 0x7ff00000 || (ix === 0x7ff00000 && lx !== 0) ||
      iy > 0x7ff00000 || (iy === 0x7ff00000 && ly !== 0)) {
    return x + y
  }
  if (x === 1.0) return deterministicAtan(y)
  const isXNeg = (hx & 0x80000000) !== 0
  const isYNeg = (hy & 0x80000000) !== 0
  const m = (isXNeg ? 2 : 0) | (isYNeg ? 1 : 0)

  if ((iy | ly) === 0) {
    switch (m) {
      case 0:
      case 1: return y
      case 2: return isYNeg ? -pi : pi
      case 3: return -pi
    }
  }
  if ((ix | lx) === 0) return isYNeg ? -pi_o_2 : pi_o_2
  if (ix === 0x7ff00000) {
    if (iy === 0x7ff00000) {
      switch (m) {
        case 0: return pi_o_4
        case 1: return -pi_o_4
        case 2: return 3.0 * pi_o_4
        case 3: return -3.0 * pi_o_4
      }
    } else {
      switch (m) {
        case 0: return 0.0
        case 1: return -0.0
        case 2: return pi
        case 3: return -pi
      }
    }
  }
  if (iy === 0x7ff00000) return isYNeg ? -pi_o_2 : pi_o_2

  const k = (iy - ix) >> 20
  let z: number
  if (k > 60) z = pi_o_2 + 0.5 * pi_lo
  else if (isXNeg && k < -60) z = 0.0
  else z = deterministicAtan(Math.abs(y / x))

  switch (m) {
    case 0: return z
    case 1: return -z
    case 2: return pi - (z - pi_lo)
    default: return (z - pi_lo) - pi
  }
}
