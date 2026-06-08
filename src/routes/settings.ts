import { Router, Request, Response } from 'express'
import fs from 'fs/promises'
import path from 'path'

const router = Router()

const dataDir = path.resolve(process.cwd(), 'data')
const keywordMapPath = path.join(dataDir, 'keywordMap.json')

const defaultMappings: Record<string, string[]> = {
  youtube: ['youtube', 'yt'],
  'google-ads': ['google ad', 'gads', 'adwords', 'google paid', 'google adword'],
  facebook: ['fb', 'facebook', 'facebook ad', 'meta', 'fb ad'],
  instagram: ['insta', 'ig', 'instagram ad'],
  whatsapp: ['whatsapp', 'wa', 'whats app'],
  clarity: [],
  'walk-in': ['walkin', 'walk in', 'direct'],
  'doctor-referral': ['doctor', 'dr.', 'physician', 'referral'],
  other: []
}

interface KeywordMapFile {
  mappings: Record<string, string[]>
  lastUpdated?: string
}

function isValidMappings(value: unknown): value is Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  return Object.values(value).every(
    (aliases) => Array.isArray(aliases) && aliases.every((alias) => typeof alias === 'string')
  )
}

async function readKeywordMap(): Promise<KeywordMapFile> {
  try {
    const raw = await fs.readFile(keywordMapPath, 'utf8')
    const parsed = JSON.parse(raw)

    if (!isValidMappings(parsed.mappings)) {
      throw new Error('Invalid keyword map file')
    }

    return {
      mappings: parsed.mappings,
      lastUpdated: parsed.lastUpdated
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Failed to read keyword map:', error)
    }

    return {
      mappings: defaultMappings,
      lastUpdated: undefined
    }
  }
}

router.get('/keyword-map', async (_req: Request, res: Response) => {
  try {
    const keywordMap = await readKeywordMap()
    res.json(keywordMap)
  } catch (error) {
    res.status(500).json({
      error: true,
      message: error instanceof Error ? error.message : 'Failed to load keyword map'
    })
  }
})

router.post('/keyword-map', async (req: Request, res: Response) => {
  try {
    const { mappings } = req.body

    if (!isValidMappings(mappings)) {
      res.status(400).json({
        error: true,
        message: 'mappings must be an object with arrays of strings'
      })
      return
    }

    const lastUpdated = new Date().toISOString()
    await fs.mkdir(dataDir, { recursive: true })
    await fs.writeFile(keywordMapPath, JSON.stringify({ mappings, lastUpdated }, null, 2))

    res.json({ success: true, lastUpdated })
  } catch (error) {
    res.status(500).json({
      error: true,
      message: error instanceof Error ? error.message : 'Failed to save keyword map'
    })
  }
})

export default router
