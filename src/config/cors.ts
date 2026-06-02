import cors from 'cors'

// ============================================
// CORS Configuration
// Development: http://localhost:3000
// Production: add Netlify URL in .env as FRONTEND_URL
// After deploying to Railway, set FRONTEND_URL
// to your Netlify app URL
// ============================================

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000'
]

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`))
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
})
