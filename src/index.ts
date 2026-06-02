// ============================================
// Hospital Dashboard - Express Backend
// Port: process.env.PORT || 5000
//
// After deploying to Railway:
// 1. Copy Railway URL e.g. https://xxx.railway.app
// 2. Set NEXT_PUBLIC_BACKEND_URL in Netlify to
//    your Railway URL
// 3. Set FRONTEND_URL in Railway .env to your
//    Netlify URL for CORS
// ============================================

import express from 'express'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import { corsMiddleware } from './config/cors'
import { logger } from './middleware/logger'
import { errorHandler } from './middleware/errorHandler'
import routes from './routes'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false
})

app.use(corsMiddleware)
app.use(express.json())
app.use(logger)

app.use('/api', apiLimiter, routes)

// Error handler - must be last.
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
  console.log(`Clarity configured: ${!!process.env.CLARITY_API_TOKEN}`)
})
