import axios, { AxiosError } from 'axios'
import { GA4Data } from '../types'
import { clearGoogleAccessToken, getGoogleAccessToken } from '../utils/googleAuth'

interface StatusError extends Error {
  status?: number
}

interface GA4RunReportRequest {
  dateRanges: Array<{ startDate: string; endDate: string }>
  dimensions?: Array<{ name: string }>
  metrics: Array<{ name: string }>
  limit?: string
}

interface GA4Row {
  dimensionValues?: Array<{ value?: string }>
  metricValues?: Array<{ value?: string }>
}

interface GA4RunReportResponse {
  rows?: GA4Row[]
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
  const clientId = process.env.GA4_CLIENT_ID
  const clientSecret = process.env.GA4_CLIENT_SECRET
  const refreshToken = process.env.GA4_REFRESH_TOKEN
  const propertyId = process.env.GA4_PROPERTY_ID?.replace(/^properties\//, '')

  if (!clientId || !clientSecret || !refreshToken || !propertyId) {
    throw createStatusError('GA4 credentials not configured', 503)
  }

  return { clientId, clientSecret, refreshToken, propertyId }
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
      throw createStatusError('Insufficient permissions for GA4', 403)
    }

    if (status === 429) {
      throw createStatusError('API rate limit exceeded for GA4', 429)
    }

    throw createStatusError(axiosError.message, status)
  }

  throw error
}

async function runReport(
  propertyId: string,
  accessToken: string,
  clientId: string,
  body: GA4RunReportRequest
): Promise<GA4RunReportResponse> {
  try {
    const response = await axios.post<GA4RunReportResponse>(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
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

function getMetric(row: GA4Row | undefined, index: number): number {
  return toNumber(row?.metricValues?.[index]?.value)
}

function formatGA4Date(value: string): string {
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`
  }

  return value
}

export async function getGA4Data(from: string, to: string): Promise<GA4Data> {
  const { clientId, clientSecret, refreshToken, propertyId } = getCredentials()
  const accessToken = await getGoogleAccessToken(clientId, clientSecret, refreshToken)

  const [mainReport, dailyReport, sourceMediumReport, topPagesReport] = await Promise.all([
    runReport(propertyId, accessToken, clientId, {
      dateRanges: [{ startDate: from, endDate: to }],
      metrics: [
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'bounceRate' },
        { name: 'conversions' }
      ]
    }),
    runReport(propertyId, accessToken, clientId, {
      dateRanges: [{ startDate: from, endDate: to }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'totalUsers' }]
    }),
    runReport(propertyId, accessToken, clientId, {
      dateRanges: [{ startDate: from, endDate: to }],
      dimensions: [{ name: 'sessionSourceMedium' }],
      metrics: [{ name: 'sessions' }],
      limit: '8'
    }),
    runReport(propertyId, accessToken, clientId, {
      dateRanges: [{ startDate: from, endDate: to }],
      dimensions: [{ name: 'landingPage' }],
      metrics: [
        { name: 'totalUsers' },
        { name: 'sessions' },
        { name: 'bounceRate' },
        { name: 'conversions' }
      ],
      limit: '10'
    })
  ])

  const mainRow = mainReport.rows?.[0]
  const totalUsers = getMetric(mainRow, 0)
  const newUsers = getMetric(mainRow, 1)

  return {
    kpis: {
      totalUsers,
      newUsers,
      returningUsers: Math.max(totalUsers - newUsers, 0),
      sessions: getMetric(mainRow, 2),
      bounceRate: Number(getMetric(mainRow, 3).toFixed(2)),
      conversions: getMetric(mainRow, 4)
    },
    trafficOverTime: (dailyReport.rows ?? []).map((row) => ({
      date: formatGA4Date(row.dimensionValues?.[0]?.value ?? ''),
      value: getMetric(row, 0)
    })),
    sourceMedium: (sourceMediumReport.rows ?? []).map((row) => ({
      name: row.dimensionValues?.[0]?.value ?? '(not set)',
      sessions: getMetric(row, 0)
    })),
    topPages: (topPagesReport.rows ?? []).map((row) => ({
      page: row.dimensionValues?.[0]?.value ?? '(not set)',
      users: getMetric(row, 0),
      sessions: getMetric(row, 1),
      bounceRate: Number(getMetric(row, 2).toFixed(2)),
      conversions: getMetric(row, 3)
    }))
  }
}
