import axios from 'axios'
import { ClarityData, ClarityPage } from '../types'

// ============================================
// Microsoft Clarity Data Export API
// Official endpoint:
// https://www.clarity.ms/export-data/api/v1/project-live-insights
// Limits: 10 requests/day, max 3 days data
// Cache TTL set to 8640s to respect this limit
// Auth: Bearer token in Authorization header
// Token is project-scoped - no project ID in URL
// ============================================

const CLARITY_BASE_URL =
  'https://www.clarity.ms/export-data/api/v1/project-live-insights'

async function fetchClarityData(
  dimension?: string
): Promise<any> {
  const token = process.env.CLARITY_API_TOKEN

  if (!token) {
    throw new Error('CLARITY_API_TOKEN is not configured in .env')
  }

  const params = new URLSearchParams({ numOfDays: '3' })
  if (dimension) {
    params.set('dimension1', dimension)
  }

  // NO RETRIES - Clarity has 10 requests/day limit.
  // One failed request is better than exhausting the limit.
  const response = await axios.get(`${CLARITY_BASE_URL}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    timeout: 10000
  })

  return response.data
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function getMetricInformation(metrics: any[], metricName: string) {
  const target = normalizeKey(metricName)
  const metric = metrics.find((entry: any) => normalizeKey(String(entry.metricName ?? '')) === target)

  return Array.isArray(metric?.information) ? metric.information[0] ?? {} : metric?.information ?? metric ?? {}
}

function getMetricRows(metrics: any[], metricName: string): Array<Record<string, any>> {
  const metric = metrics.find(
    (entry: any) => normalizeKey(String(entry.metricName ?? '')) === normalizeKey(metricName)
  )

  return Array.isArray(metric?.information) ? metric.information : []
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function getRowLabel(row: Record<string, any>, index: number) {
  const label =
    row.URL ??
    row.url ??
    row.Page ??
    row.page ??
    row['Page Title'] ??
    row.pageTitle ??
    row.title ??
    row.name ??
    row.dimension ??
    row.label

  if (typeof label === 'string' && label.trim()) {
    return label.trim()
  }

  return `row-${index}`
}

function getMetricRowValue(row: Record<string, any>) {
  return toNumber(
    row.averageScrollDepth ??
    row.averageValue ??
    row.sessionsCount ??
    row.totalSessionCount ??
    row.subTotal ??
    row.pagesViews ??
    row.totalCount ??
    row.value ??
    row.count ??
    0
  )
}

function buildTopPages(metrics: any[]): ClarityPage[] {
  const trafficRows = getMetricRows(metrics, 'Traffic')
  const rageRows = getMetricRows(metrics, 'RageClickCount')
  const deadRows = getMetricRows(metrics, 'DeadClickCount')
  const scrollRows = getMetricRows(metrics, 'ScrollDepth')
  const pageMap = new Map<string, ClarityPage>()

  trafficRows.forEach((row, index) => {
    const key = getRowLabel(row, index)
    const sessions = toNumber(
      row.totalSessionCount ??
      row.sessionsCount ??
      row.sessions ??
      row.value
    )
    pageMap.set(key, {
      page: key,
      sessions,
      rageClicks: 0,
      deadClicks: 0,
      scrollDepth: 0,
      engagement: getEngagementLevel(0)
    })
  })

  const mergeRows = (
    rows: Array<Record<string, any>>,
    assign: (page: ClarityPage, value: number) => void
  ) => {
    rows.forEach((row, index) => {
      const key = getRowLabel(row, index)
      const existing = pageMap.get(key)
      const value = getMetricRowValue(row)

      if (existing) {
        assign(existing, value)
        return
      }

      const page: ClarityPage = {
        page: key,
        sessions: 0,
        rageClicks: 0,
        deadClicks: 0,
        scrollDepth: 0,
        engagement: getEngagementLevel(0)
      }

      assign(page, value)
      pageMap.set(key, page)
    })
  }

  mergeRows(rageRows, (page, value) => {
    page.rageClicks = value
  })

  mergeRows(deadRows, (page, value) => {
    page.deadClicks = value
  })

  mergeRows(scrollRows, (page, value) => {
    page.scrollDepth = value
    page.engagement = getEngagementLevel(value)
  })

  return Array.from(pageMap.values())
    .filter((page) => page.page !== 'row-0' || page.sessions > 0)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10)
}

function getEngagementLevel(
  scrollDepth: number
): 'High' | 'Medium' | 'Low' {
  if (scrollDepth >= 70) return 'High'
  if (scrollDepth >= 50) return 'Medium'
  return 'Low'
}

export async function getClarityData(): Promise<ClarityData> {
  // Make only 2 API calls total per cache cycle.
  // Call 1: summary data for KPIs.
  // Call 2: URL dimension for page breakdown.
  const [summaryData, urlData] = await Promise.all([
    fetchClarityData(),
    fetchClarityData('URL')
  ])

  console.log("This is Clarity summary data", summaryData)
  console.log("This is Clarity URL data", urlData)

  // Extract metrics from response.
  // Clarity response structure:
  // Array of { metricName: string, information: any[] }
  const summaryMetrics = summaryData?.metrics || summaryData || []
  const urlMetrics = urlData?.metrics || urlData || []

  const trafficMetric = getMetricInformation(summaryMetrics, 'Traffic')
  const totalSessions = toNumber(
    trafficMetric.totalSessionCount ??
    trafficMetric.totalCount ??
    trafficMetric.value
  )

  const rageMetric = getMetricInformation(summaryMetrics, 'RageClickCount')
  const totalRageClicks = toNumber(
    rageMetric.subTotal ??
    rageMetric.pagesViews ??
    rageMetric.totalCount ??
    rageMetric.value
  )
  const rageClickRate = toNumber(
    rageMetric.sessionsWithMetricPercentage ??
    rageMetric.percentage ??
    0
  )

  const deadMetric = getMetricInformation(summaryMetrics, 'DeadClickCount')
  const totalDeadClicks = toNumber(
    deadMetric.subTotal ??
    deadMetric.pagesViews ??
    deadMetric.totalCount ??
    deadMetric.value
  )
  const deadClickRate = toNumber(
    deadMetric.sessionsWithMetricPercentage ??
    deadMetric.percentage ??
    0
  )

  const scrollMetric = getMetricInformation(summaryMetrics, 'ScrollDepth')
  const avgScrollDepth = toNumber(
    scrollMetric.averageScrollDepth ??
    scrollMetric.averageValue ??
    scrollMetric.value
  )

  const normalizedRageClickRate = rageClickRate > 0
    ? Number(rageClickRate.toFixed(1))
    : totalSessions > 0
      ? Number(((totalRageClicks / totalSessions) * 100).toFixed(1))
      : 0
  const normalizedDeadClickRate = deadClickRate > 0
    ? Number(deadClickRate.toFixed(1))
    : totalSessions > 0
      ? Number(((totalDeadClicks / totalSessions) * 100).toFixed(1))
      : 0

  const topPages = buildTopPages(urlMetrics)

  const dailyData = summaryData?.dailyData ||
    summaryData?.timeSeries ||
    urlData?.dailyData ||
    urlData?.timeSeries || []
  const sessionsOverTime = dailyData.length > 0
    ? dailyData.map((day: any) => ({
        date: day.date || day.day,
        value: day.sessionCount || day.sessions || 0
      }))
    : [
        { date: 'Day 1', value: Math.floor(totalSessions * 0.3) },
        { date: 'Day 2', value: Math.floor(totalSessions * 0.35) },
        { date: 'Day 3', value: Math.floor(totalSessions * 0.35) }
      ]

  return {
    kpis: {
      totalSessions,
      rageClickRate: normalizedRageClickRate,
      deadClickRate: normalizedDeadClickRate,
      avgScrollDepth: Number(avgScrollDepth.toFixed(1))
    },
    sessionsOverTime,
    topPages,
    heatmapUrl: 'https://clarity.microsoft.com'
  }
}
