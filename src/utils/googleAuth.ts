import axios, { AxiosError } from 'axios'
import { getCache } from '../config/cache'

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
}

function getTokenCacheKey(clientId: string, refreshToken: string): string {
  return `access_token_${clientId.slice(-8)}_${refreshToken.slice(-8)}`
}

export function clearGoogleAccessToken(clientId: string): void {
  const cache = getCache()
  const prefix = `access_token_${clientId.slice(-8)}`
  const keys = cache.keys()
  for (const key of keys) {
    if (key.startsWith(prefix)) {
      cache.del(key)
    }
  }
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error_description?: string; error?: string }>
    return (
      axiosError.response?.data?.error_description ||
      axiosError.response?.data?.error ||
      axiosError.message
    )
  }

  return error instanceof Error ? error.message : 'Unknown error'
}

export async function getGoogleAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const cache = getCache()
  const cacheKey = getTokenCacheKey(clientId, refreshToken)
  const cachedToken = cache.get<string>(cacheKey)

  if (cachedToken) {
    return cachedToken
  }

  try {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })

    const response = await axios.post<GoogleTokenResponse>(
      'https://oauth2.googleapis.com/token',
      body.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    )

    const { access_token: accessToken, expires_in: expiresIn } = response.data
    const ttl = Math.max(expiresIn - 60, 1)

    cache.set(cacheKey, accessToken, ttl)

    return accessToken
  } catch (error: unknown) {
    throw new Error(`Failed to get Google access token: ${getErrorMessage(error)}`)
  }
}
