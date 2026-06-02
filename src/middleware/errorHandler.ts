import { Request, Response, NextFunction } from 'express'
import { ApiError } from '../types'

export function errorHandler(
  err: any,
  req: Request,
  res: Response<ApiError>,
  next: NextFunction
) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message)

  const isDev = process.env.NODE_ENV !== 'production'
  const status = err.status || 500

  res.status(status).json({
    error: true,
    message: isDev ? err.message : 'Something went wrong',
    status
  })
}
