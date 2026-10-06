import { isObj } from '../contracts/replay.nested-models.js'

/**
 * Preserves wire insertion order after sanitization, without restoring any value
 * or key removed by the sanitizer. Values always come from the detached DTO.
 */
export function preserveWireKeyOrder(source: unknown, sanitized: unknown): unknown {
  if (Array.isArray(sanitized)) {
    const original = Array.isArray(source) ? source : []
    return sanitized.map((value, index) => preserveWireKeyOrder(original[index], value))
  }
  if (!isObj(sanitized)) return sanitized
  const original = isObj(source) ? source : {}
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(original)) {
    if (Object.hasOwn(sanitized, key)) result[key] = preserveWireKeyOrder(original[key], sanitized[key])
  }
  for (const key of Object.keys(sanitized)) {
    if (!Object.hasOwn(original, key)) result[key] = preserveWireKeyOrder(undefined, sanitized[key])
  }
  return result
}
