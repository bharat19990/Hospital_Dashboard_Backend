import axios, { AxiosError } from 'axios'
import { SearchConsoleData } from '../types'
import { clearGoogleAccessToken, getGoogleAccessToken } from '../utils/googleAuth'

interface StatusError extends Error {
  status?: number
}

interface SearchConsoleRequest {
  startDate: string
  endDate: string
  dimensions: string[]
  rowLimit?: number
}

interface SearchConsoleResponse {
  rows?: Array<{
    keys?: string[]
    clicks?: number
    impressions?: number
    ctr?: number
    position?: number
  }>
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
  const clientId = process.env.SEARCH_CONSOLE_CLIENT_ID
  const clientSecret = process.env.SEARCH_CONSOLE_CLIENT_SECRET
  const refreshToken = process.env.SEARCH_CONSOLE_REFRESH_TOKEN
  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL

  if (!clientId || !clientSecret || !refreshToken || !siteUrl) {
    throw createStatusError('Search Console credentials not configured', 503)
  }

  return { clientId, clientSecret, refreshToken, siteUrl }
}

function handleApiError(error: unknown, clientId: string): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError
    const status = axiosError.response?.status

    if (status === 401) {
      clearGoogleAccessToken(clientId)
      throw createStatusError('Access token expired — will refresh on next request', 401)
    }

    if (status === 403) {
      throw createStatusError('Insufficient permissions for Search Console', 403)
    }

    if (status === 429) {
      throw createStatusError('API rate limit exceeded for Search Console', 429)
    }

    throw createStatusError(axiosError.message, status)
  }

  throw error
}

async function querySearchAnalytics(
  encodedSite: string,
  accessToken: string,
  clientId: string,
  body: SearchConsoleRequest
): Promise<SearchConsoleResponse> {
  try {
    const response = await axios.post<SearchConsoleResponse>(
      `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
      body,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    )

    return response.data
  } catch (error: unknown) {
    handleApiError(error, clientId)
  }
}

export async function getSearchConsoleData(from: string, to: string): Promise<SearchConsoleData> {
  const { clientId, clientSecret, refreshToken, siteUrl } = getCredentials()
  const accessToken = await getGoogleAccessToken(clientId, clientSecret, refreshToken)
  const encodedSite = encodeURIComponent(siteUrl)

  const [overall, daily, queries, pages] = await Promise.all([
    querySearchAnalytics(encodedSite, accessToken, clientId, {
      startDate: from,
      endDate: to,
      dimensions: []
    }),
    querySearchAnalytics(encodedSite, accessToken, clientId, {
      startDate: from,
      endDate: to,
      dimensions: ['date']
    }),
    querySearchAnalytics(encodedSite, accessToken, clientId, {
      startDate: from,
      endDate: to,
      dimensions: ['query'],
      rowLimit: 10
    }),
    querySearchAnalytics(encodedSite, accessToken, clientId, {
      startDate: from,
      endDate: to,
      dimensions: ['page'],
      rowLimit: 10
    })
  ])

  const summary = overall.rows?.[0]

  return {
    kpis: {
      totalClicks: toNumber(summary?.clicks),
      totalImpressions: toNumber(summary?.impressions),
      avgCTR: Number(toNumber(summary?.ctr).toFixed(4)),
      avgPosition: Number(toNumber(summary?.position).toFixed(2))
    },
    clicksOverTime: (daily.rows ?? []).map((row) => ({
      date: row.keys?.[0] ?? '',
      clicks: toNumber(row.clicks),
      impressions: toNumber(row.impressions)
    })),
    topQueries: (queries.rows ?? []).map((row) => ({
      query: row.keys?.[0] ?? '(not set)',
      clicks: toNumber(row.clicks),
      impressions: toNumber(row.impressions),
      ctr: Number(toNumber(row.ctr).toFixed(4)),
      position: Number(toNumber(row.position).toFixed(2))
    })),
    topPages: (pages.rows ?? []).map((row) => ({
      page: row.keys?.[0] ?? '(not set)',
      clicks: toNumber(row.clicks),
      impressions: toNumber(row.impressions),
      ctr: Number(toNumber(row.ctr).toFixed(4))
    }))
  }
}
