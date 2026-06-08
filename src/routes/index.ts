import { Router } from 'express'
import clarityRouter from './clarity'
import ga4Router from './ga4'
import healthRouter from './health'
import searchConsoleRouter from './searchConsole'
import settingsRouter from './settings'
import youtubeRouter from './youtube'

const router = Router()

router.use('/clarity', clarityRouter)
router.use('/youtube', youtubeRouter)
router.use('/ga4', ga4Router)
router.use('/search-console', searchConsoleRouter)
router.use('/health', healthRouter)
router.use('/settings', settingsRouter)

export default router
