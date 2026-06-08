import { Router, Request, Response } from 'express'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  res.json({
    youtube: !!(
      process.env.YOUTUBE_CLIENT_ID &&
      process.env.YOUTUBE_CLIENT_SECRET &&
      process.env.YOUTUBE_REFRESH_TOKEN
    ),
    ga4: !!(
      process.env.GA4_CLIENT_ID &&
      process.env.GA4_CLIENT_SECRET &&
      process.env.GA4_REFRESH_TOKEN &&
      process.env.GA4_PROPERTY_ID
    ),
    searchConsole: !!(
      process.env.SEARCH_CONSOLE_CLIENT_ID &&
      process.env.SEARCH_CONSOLE_CLIENT_SECRET &&
      process.env.SEARCH_CONSOLE_REFRESH_TOKEN &&
      process.env.SEARCH_CONSOLE_SITE_URL
    ),
    googleAds: !!(
      process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN
    ),
    facebook: !!(process.env.FACEBOOK_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN),
    instagram: !!(process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN),
    whatsapp: !!(process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN),
    clarity: !!process.env.CLARITY_API_TOKEN,
    zoho: !!(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET && process.env.ZOHO_REFRESH_TOKEN),
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})

export default router
