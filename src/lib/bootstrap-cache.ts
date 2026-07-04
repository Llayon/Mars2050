import type { ColonyBootstrapPayload } from '@/domains/colony/colony.types'

export const BOOTSTRAP_CACHE_SCHEMA_VERSION = 1
export const BOOTSTRAP_CACHE_TTL_MS = 30 * 60 * 1000

interface BootstrapCacheEnvelope {
  schemaVersion: number
  savedAt: number
  data: ColonyBootstrapPayload
}

function cacheKey(colonyId: string): string {
  return `mars2050_bootstrap:${colonyId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBootstrapPayload(value: unknown): value is ColonyBootstrapPayload {
  if (!isRecord(value) || !isRecord(value.colony)) return false
  return (
    typeof value.colony.id === 'string' &&
    Array.isArray(value.resources) &&
    Array.isArray(value.buildings) &&
    (value.population === null || isRecord(value.population))
  )
}

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function readBootstrapCache(colonyId: string): ColonyBootstrapPayload | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(cacheKey(colonyId))
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null
    if (parsed.schemaVersion !== BOOTSTRAP_CACHE_SCHEMA_VERSION) return null
    if (typeof parsed.savedAt !== 'number') return null
    if (Date.now() - parsed.savedAt > BOOTSTRAP_CACHE_TTL_MS) {
      clearBootstrapCache(colonyId)
      return null
    }
    return isBootstrapPayload(parsed.data) ? parsed.data : null
  } catch {
    return null
  }
}

export function writeBootstrapCache(colonyId: string, data: ColonyBootstrapPayload): void {
  const storage = getStorage()
  if (!storage) return

  try {
    const envelope: BootstrapCacheEnvelope = {
      schemaVersion: BOOTSTRAP_CACHE_SCHEMA_VERSION,
      savedAt: Date.now(),
      data,
    }
    storage.setItem(cacheKey(colonyId), JSON.stringify(envelope))
  } catch {
    // Ignore storage quota and privacy-mode failures.
  }
}

export function clearBootstrapCache(colonyId: string): void {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.removeItem(cacheKey(colonyId))
  } catch {
    // Ignore unavailable storage.
  }
}
