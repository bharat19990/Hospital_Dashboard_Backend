import { Router } from 'express'
import clarityRouter from './clarity'
import healthRouter from './health'

const router = Router()

router.use('/clarity', clarityRouter)
router.use('/health', healthRouter)

export default router
