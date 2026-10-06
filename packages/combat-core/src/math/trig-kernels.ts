// Adapted from fdlibm / V8 ieee754 (Chromium 138.0.7204.174).
// Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
// Developed at SunSoft, a Sun Microsystems, Inc. business.
// Permission to use, copy, modify, and distribute this software is freely
// granted, provided that this notice is preserved.
// Modified significantly by Google Inc. Copyright 2016 the V8 project authors.
import { fromWords, highWord } from './trig-bits.js'

/** fdlibm sine on [-pi/4, pi/4], including the argument-reduction tail. */
export function kernelSin(x: number, tail: number, reduced: boolean): number {
  if ((highWord(x) & 0x7fffffff) < 0x3e400000) return x
  const z = x * x
  const v = z * x
  const s1 = -1.66666666666666324348e-1
  const r = 8.33333333332248946124e-3 + z * (-1.98412698298579493134e-4 +
    z * (2.75573137070700676789e-6 + z * (-2.50507602534068634195e-8 + z * 1.58969099521155010221e-10)))
  return reduced ? x - ((z * (0.5 * tail - v * r) - tail) - v * s1) : x + v * (s1 + z * r)
}

/** fdlibm cosine; operation order is part of the deterministic contract. */
export function kernelCos(x: number, tail: number): number {
  const ix = highWord(x) & 0x7fffffff
  if (ix < 0x3e400000) return 1
  const z = x * x
  const r = z * (4.16666666666666019037e-2 + z * (-1.38888888888741095749e-3 +
    z * (2.48015872894767294178e-5 + z * (-2.75573143513906633035e-7 +
      z * (2.08757232129817482790e-9 + z * -1.13596475577881948265e-11)))))
  if (ix < 0x3fd33333) return 1 - (0.5 * z - (z * r - x * tail))
  const qx = ix > 0x3fe90000 ? 0.28125 : fromWords(ix - 0x00200000)
  return (1 - qx) - ((0.5 * z - qx) - (z * r - x * tail))
}
