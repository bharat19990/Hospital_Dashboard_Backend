import { Router, Request, Response, NextFunction } from "express";
import OpenAI from "openai";
import { getCache } from "../config/cache";
import { ApiSuccess, ApiError } from "../types";

const router = Router();

// AI Insights specific cache TTL: 30 minutes
const AI_INSIGHTS_CACHE_TTL = 1800;

// Lazy-load OpenAI client to ensure environment variables are loaded
let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

interface AIInsightsRequest {
  channel: string;
  dateRange: { from: string; to: string };
  metrics: Record<string, string | number>;
  refresh?: boolean;
}

interface AIInsightsData {
  insights: string[];
  cachedAt: string;
}

function buildUserPrompt(
  channel: string,
  dateRange: { from: string; to: string },
  metrics: Record<string, string | number>,
): string {
  const metricsLines = Object.entries(metrics)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  return `Here is our ${channel} performance for ${dateRange.from} to ${dateRange.to}:
${metricsLines}

Give 3-5 specific next steps to improve performance. Be concise and hospital-specific.`;
}

function generateCacheKey(
  channel: string,
  dateRange: { from: string; to: string },
): string {
  return `ai_insights_${channel}_${dateRange.from}_${dateRange.to}`;
}

async function generateInsights(
  channel: string,
  dateRange: { from: string; to: string },
  metrics: Record<string, string | number>,
): Promise<string[]> {
  const userPrompt = buildUserPrompt(channel, dateRange, metrics);
  const openai = getOpenAIClient();

  const message = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a digital marketing expert advising a hospital's marketing team in India. Be specific, concise, and actionable. Always respond with a JSON array of 3 to 5 strings, each string being one recommendation. No preamble, no markdown, just a raw JSON array.",
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const responseText = message.choices[0]?.message?.content?.trim() || "[]";

  // Try to parse as JSON array
  try {
    const parsed = JSON.parse(responseText);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    // Fallback: split by newlines if JSON parsing fails
    return responseText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  return [];
}

router.post(
  "/",
  async (
    req: Request<unknown, unknown, AIInsightsRequest>,
    res: Response<ApiSuccess<AIInsightsData> | ApiError>,
    next: NextFunction,
  ) => {
    try {
      const { channel, dateRange, metrics, refresh } = req.body;

      // Validate required fields
      if (!channel || !dateRange || !metrics) {
        return res.status(400).json({
          error: true,
          message: "Missing required fields: channel, dateRange, metrics",
        });
      }

      // Validate OpenAI API key
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({
          error: true,
          message: "OpenAI API key not configured",
        });
      }

      const cache = getCache();
      const cacheKey = generateCacheKey(channel, dateRange);

      // Check cache first (unless refresh is requested)
      if (!refresh) {
        const cached = cache.get<{ data: AIInsightsData; cachedAt: string }>(
          cacheKey,
        );
        if (cached) {
          return res.json({
            data: cached.data,
            cachedAt: cached.cachedAt,
            source: "cache",
          });
        }
      }

      // Generate new insights
      const insights = await generateInsights(channel, dateRange, metrics);

      const cachedAt = new Date().toISOString();
      const data: AIInsightsData = { insights, cachedAt };

      // Cache the result
      cache.set(cacheKey, { data, cachedAt }, AI_INSIGHTS_CACHE_TTL);

      return res.json({
        data,
        cachedAt,
        source: "live",
      });
    } catch (error: unknown) {
      next(error);
    }
  },
);

export default router;
