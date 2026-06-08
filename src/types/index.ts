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

export interface YouTubeData {
  kpis: {
    totalViews: number
    watchTimeHours: number
    subscriberChange: number
    avgCTR: number
  }
  viewsOverTime: { date: string; value: number }[]
  trafficSources: {
    name: string
    value: number
    color: string
  }[]
  topVideos: {
    title: string
    views: number
    likes: number
    comments: number
  }[]
}

export interface GA4Data {
  kpis: {
    totalUsers: number
    newUsers: number
    returningUsers: number
    sessions: number
    bounceRate: number
    conversions: number
  }
  trafficOverTime: { date: string; value: number }[]
  sourceMedium: { name: string; sessions: number }[]
  topPages: {
    page: string
    users: number
    sessions: number
    bounceRate: number
    conversions: number
  }[]
}

export interface SearchConsoleData {
  kpis: {
    totalClicks: number
    totalImpressions: number
    avgCTR: number
    avgPosition: number
  }
  clicksOverTime: {
    date: string
    clicks: number
    impressions: number
  }[]
  topQueries: {
    query: string
    clicks: number
    impressions: number
    ctr: number
    position: number
  }[]
  topPages: {
    page: string
    clicks: number
    impressions: number
    ctr: number
  }[]
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
