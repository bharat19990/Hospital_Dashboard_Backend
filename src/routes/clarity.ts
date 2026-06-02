import { Router, Request, Response, NextFunction } from 'express'
import { getClarityData } from '../services/clarity'
import { getCache, CACHE_TTL } from '../config/cache'
import { ApiSuccess, ClarityData } from '../types'

const router = Router()

// ============================================
// GET /api/clarity
// Returns Clarity analytics data
// Cached for 8640s (2.4 hours) to respect
// the 10 requests/day API limit
// NO RETRIES on failure - fail fast
// ============================================
router.get('/', async (
  req: Request,
  res: Response<ApiSuccess<ClarityData>>,
  next: NextFunction
) => {
  try {
    const cache = getCache()
    const cacheKey = 'clarity_data'

    const cached = cache.get<{ data: ClarityData; cachedAt: string }>(cacheKey)
    if (cached) {
      return res.json({
        data: cached.data,
        cachedAt: cached.cachedAt,
        source: 'cache'
      })
    }

    const data = await getClarityData()
    console.log("This is clarity data -->",data)
    const cachedAt = new Date().toISOString()

    cache.set(cacheKey, { data, cachedAt }, CACHE_TTL.clarity)

    return res.json({
      data,
      cachedAt,
      source: 'live'
    })
  } catch (error: any) {
    next(error)
  }
})

export default router
