/**
 * Lightweight in-memory cache for API responses.
 * Reduces DB load for frequently-accessed, slowly-changing data.
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

export function getCached<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.data as T
}

export function setCache<T>(key: string, data: T, ttlSeconds: number): void {
  store.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  })
}

export function invalidateCache(pattern?: string): void {
  if (!pattern) {
    store.clear()
    return
  }
  for (const key of store.keys()) {
    if (key.includes(pattern)) {
      store.delete(key)
    }
  }
}

// Auto-cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)
