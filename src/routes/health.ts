import { Router, Request, Response } from 'express'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  res.json({
    clarity: !!process.env.CLARITY_API_TOKEN,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})

export default router
