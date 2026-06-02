import NodeCache from 'node-cache'

// ============================================
// Cache singleton
// Clarity TTL: 8640 seconds (2.4 hours)
// Reason: Clarity allows only 10 requests/day
// 24 hours / 10 requests = 2.4 hours per request
// This ensures we never exceed the daily limit
// ============================================

let cacheInstance: NodeCache | null = null

export function getCache(): NodeCache {
  if (!cacheInstance) {
    cacheInstance = new NodeCache({ useClones: false })
  }
  return cacheInstance
}

export const CACHE_TTL = {
  clarity: 8640
}
