export interface ClarityKpis {
  totalSessions: number
  rageClickRate: number
  deadClickRate: number
  avgScrollDepth: number
}

export interface ClarityPage {
  page: string
  sessions: number
  rageClicks: number
  deadClicks: number
  scrollDepth: number
  engagement: 'High' | 'Medium' | 'Low'
}

export interface ClarityData {
  kpis: ClarityKpis
  sessionsOverTime: { date: string; value: number }[]
  topPages: ClarityPage[]
  heatmapUrl: string
}

export interface ApiSuccess<T> {
  data: T
  cachedAt: string
  source: 'live' | 'cache'
}

export interface ApiError {
  error: true
  message: string
  status: number
}
