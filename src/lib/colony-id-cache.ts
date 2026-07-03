const CACHE_PREFIX = 'mars2050_colony_id:'

export function getCachedColonyId(userId: string): string | null {
  try {
    return localStorage.getItem(`${CACHE_PREFIX}${userId}`)
  } catch {
    return null
  }
}

export function setCachedColonyId(userId: string, colonyId: string): void {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${userId}`, colonyId)
  } catch {
    // Ignore unavailable storage.
  }
}
