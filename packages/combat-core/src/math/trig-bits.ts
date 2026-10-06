// Synchronous scratch storage only; no battle data or results are retained.
const bits = new DataView(new ArrayBuffer(8))

export function highWord(value: number): number {
  bits.setFloat64(0, value, false)
  return bits.getUint32(0, false)
}

export function fromWords(high: number, low = 0): number {
  bits.setUint32(0, high, false)
  bits.setUint32(4, low, false)
  return bits.getFloat64(0, false)
}

export function replaceHighWord(value: number, high: number): number {
  bits.setFloat64(0, value, false)
  bits.setUint32(0, high, false)
  return bits.getFloat64(0, false)
}
