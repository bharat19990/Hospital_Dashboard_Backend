import axios, { AxiosError, AxiosRequestConfig } from 'axios'
import { YouTubeData } from '../types'
import { clearGoogleAccessToken, getGoogleAccessToken } from '../utils/googleAuth'

interface StatusError extends Error {
  status?: number
}

interface YouTubeChannelResponse {
  items?: Array<{
    statistics?: {
      viewCount?: string
      subscriberCount?: string
    }
  }>
}

interface YouTubeSearchResponse {
  items?: Array<{
    id?: {
      videoId?: string
    }
    snippet?: {
      title?: string
    }
  }>
}

interface YouTubeVideosResponse {
  items?: Array<{
    id?: string
    snippet?: {
      title?: string
    }
    statistics?: {
      viewCount?: string
      likeCount?: string
      commentCount?: string
      favoriteCount?: string
    }
  }>
}

interface YouTubeAnalyticsResponse {
  rows?: Array<Array<string | number | null>>
}

const TRAFFIC_SOURCE_LABELS: Record<string, string> = {
  YT_SEARCH: 'YouTube Search',
  SUGGESTED: 'Suggested Videos',
  EXT_URL: 'External',
  DIRECT: 'Direct or Unknown',
  PLAYLIST: 'Playlist',
  NOTIFICATION: 'Notification',
  OTHER: 'Other'
}

const TRAFFIC_SOURCE_COLORS: Record<string, string> = {
  YT_SEARCH: '#FF0000',
  SUGGESTED: '#FF6B6B',
  EXT_URL: '#FFA500',
  DIRECT: '#FFD700',
  PLAYLIST: '#4285F4',
  NOTIFICATION: '#0D9488',
  OTHER: '#CCCCCC'
}

function createStatusError(message: string, status?: number): StatusError {
  const error: StatusError = new Error(message)
  if (status) {
    error.status = status
  }
  return error
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function getCredentials() {
  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw createStatusError('YOUTUBE credentials not configured', 503)
  }

  return { clientId, clientSecret, refreshToken }
}

function handleApiError(error: unknown, service: string, clientId: string): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError
    const status = axiosError.response?.status

    if (status === 401) {
      clearGoogleAccessToken(clientId)
      throw createStatusError('Access token expired — will refresh on next request', 401)
    }

    if (status === 403) {
      throw createStatusError(`Insufficient permissions for ${service}`, 403)
    }

    if (status === 429) {
      throw createStatusError(`API rate limit exceeded for ${service}`, 429)
    }

    throw createStatusError(axiosError.message, status)
  }

  throw error
}

async function googleGet<T>(
  url: string,
  accessToken: string,
  clientId: string,
  service: string,
  config: AxiosRequestConfig = {}
): Promise<T> {
  try {
    const response = await axios.get<T>(url, {
      ...config,
      headers: {
        ...config.headers,
        Authorization: `Bearer ${accessToken}`
      },
      timeout: 10000
    })

    return response.data
  } catch (error: unknown) {
    handleApiError(error, service, clientId)
  }
}

async function getChannelStats(
  accessToken: string,
  clientId: string
): Promise<{ viewCount: number; subscriberCount: number }> {
  const data = await googleGet<YouTubeChannelResponse>(
    'https://www.googleapis.com/youtube/v3/channels',
    accessToken,
    clientId,
    'YouTube',
    {
      params: {
        part: 'statistics,snippet',
        mine: true
      }
    }
  )

  const statistics = data.items?.[0]?.statistics

  return {
    viewCount: toNumber(statistics?.viewCount),
    subscriberCount: toNumber(statistics?.subscriberCount)
  }
}

export async function getYouTubeData(from: string, to: string): Promise<YouTubeData> {
  const { clientId, clientSecret, refreshToken } = getCredentials()
  const accessToken = await getGoogleAccessToken(clientId, clientSecret, refreshToken)

  const [startStats, endStats, searchData, analyticsData, trafficData] = await Promise.all([
    getChannelStats(accessToken, clientId),
    getChannelStats(accessToken, clientId),
    googleGet<YouTubeSearchResponse>(
      'https://www.googleapis.com/youtube/v3/search',
      accessToken,
      clientId,
      'YouTube',
      {
        params: {
          part: 'snippet',
          type: 'video',
          order: 'viewCount',
          publishedAfter: `${from}T00:00:00Z`,
          publishedBefore: `${to}T23:59:59Z`,
          maxResults: 5
        }
      }
    ),
    googleGet<YouTubeAnalyticsResponse>(
      'https://youtubeanalytics.googleapis.com/v2/reports',
      accessToken,
      clientId,
      'YouTube',
      {
        params: {
          ids: 'channel==MINE',
          metrics: 'views,estimatedMinutesWatched,annotationClickThroughRate',
          dimensions: 'day',
          startDate: from,
          endDate: to
        }
      }
    ),
    googleGet<YouTubeAnalyticsResponse>(
      'https://youtubeanalytics.googleapis.com/v2/reports',
      accessToken,
      clientId,
      'YouTube',
      {
        params: {
          ids: 'channel==MINE',
          metrics: 'views',
          dimensions: 'insightTrafficSourceType',
          startDate: from,
          endDate: to
        }
      }
    )
  ])

  const videoIds = (searchData.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id))

  const videosData = videoIds.length > 0
    ? await googleGet<YouTubeVideosResponse>(
        'https://www.googleapis.com/youtube/v3/videos',
        accessToken,
        clientId,
        'YouTube',
        {
          params: {
            part: 'statistics,snippet',
            id: videoIds.join(',')
          }
        }
      )
    : { items: [] }

  const rows = analyticsData.rows ?? []
  const totalMinutesWatched = rows.reduce((sum, row) => sum + toNumber(row[2]), 0)
  const ctrValues = rows.map((row) => toNumber(row[3])).filter((value) => value > 0)
  const avgCTR = ctrValues.length > 0
    ? ctrValues.reduce((sum, value) => sum + value, 0) / ctrValues.length
    : 0

  return {
    kpis: {
      totalViews: endStats.viewCount,
      watchTimeHours: Number((totalMinutesWatched / 60).toFixed(2)),
      subscriberChange: endStats.subscriberCount - startStats.subscriberCount,
      avgCTR: Number(avgCTR.toFixed(2))
    },
    viewsOverTime: rows.map((row) => ({
      date: String(row[0] ?? ''),
      value: toNumber(row[1])
    })),
    trafficSources: (trafficData.rows ?? []).map((row) => {
      const code = String(row[0] ?? 'OTHER')
      return {
        name: TRAFFIC_SOURCE_LABELS[code] ?? code,
        value: toNumber(row[1]),
        color: TRAFFIC_SOURCE_COLORS[code] ?? TRAFFIC_SOURCE_COLORS.OTHER
      }
    }),
    topVideos: (videosData.items ?? []).map((video) => ({
      title: video.snippet?.title ?? 'Untitled video',
      views: toNumber(video.statistics?.viewCount),
      likes: toNumber(video.statistics?.likeCount),
      comments: toNumber(video.statistics?.commentCount)
    }))
  }
}
