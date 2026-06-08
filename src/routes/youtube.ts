import { Router, Request, Response, NextFunction } from 'express'
import { getCache, CACHE_TTL } from '../config/cache'
import { getYouTubeData } from '../services/youtube'
import { ApiSuccess, YouTubeData } from '../types'

const router = Router()

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getDateRange(req: Request): { from: string; to: string } {
  const to = typeof req.query.to === 'string' ? req.query.to : formatDate(new Date())
  const defaultFrom = new Date(`${to}T00:00:00Z`)
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 30)

  const from = typeof req.query.from === 'string' ? req.query.from : formatDate(defaultFrom)

  return { from, to }
}

router.get('/', async (
  req: Request,
  res: Response<ApiSuccess<YouTubeData>>,
  next: NextFunction
) => {
  try {
    const { from, to } = getDateRange(req)
    const cache = getCache()
    const cacheKey = `youtube_${from}_${to}`

    const cached = cache.get<{ data: YouTubeData; cachedAt: string }>(cacheKey)
    if (cached) {
      return res.json({
        data: cached.data,
        cachedAt: cached.cachedAt,
        source: 'cache'
      })
    }

    const data = await getYouTubeData(from, to)
    const cachedAt = new Date().toISOString()

    cache.set(cacheKey, { data, cachedAt }, CACHE_TTL.youtube)

    return res.json({
      data,
      cachedAt,
      source: 'live'
    })
  } catch (error: unknown) {
    next(error)
  }
})

export default router
