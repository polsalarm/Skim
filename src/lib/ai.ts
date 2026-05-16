import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

/**
 * Pick a model based on which API key the user has configured.
 *
 * Priority:
 *   1. AI_GATEWAY_API_KEY  → use Vercel AI Gateway (plain string model IDs)
 *   2. GOOGLE_GENERATIVE_AI_API_KEY → use Google Gemini directly (free tier)
 *
 * Override the model name with AI_MODEL / AI_CHAT_MODEL.
 */
function pickModel(envModel: string | undefined, fallback: string): LanguageModel {
  if (process.env.AI_GATEWAY_API_KEY) {
    return (envModel ?? fallback) as unknown as LanguageModel;
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const modelId = envModel ?? "gemini-2.5-flash";
    return google(modelId);
  }
  throw new Error(
    "No AI provider configured. Set either AI_GATEWAY_API_KEY (Vercel AI Gateway) or GOOGLE_GENERATIVE_AI_API_KEY (Google AI Studio free tier) in .env.local",
  );
}

export const ANALYSIS_MODEL: LanguageModel = pickModel(
  process.env.AI_MODEL,
  "openai/gpt-5-mini",
);

export const CHAT_MODEL: LanguageModel = pickModel(
  process.env.AI_CHAT_MODEL ?? process.env.AI_MODEL,
  "openai/gpt-5-mini",
);

/**
 * Whether the active provider is Google Gemini.
 *
 * When true, we can pass YouTube URLs directly to the model as file parts —
 * Gemini downloads and processes the video itself, bypassing YouTube's
 * blocking of datacenter IPs.
 */
export const IS_GOOGLE_PROVIDER = Boolean(
  process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.AI_GATEWAY_API_KEY,
);

export const MAX_TRANSCRIPT_CHARS = 120_000;

export function truncateTranscript(text: string): {
  text: string;
  truncated: boolean;
} {
  if (text.length <= MAX_TRANSCRIPT_CHARS) {
    return { text, truncated: false };
  }
  return {
    text:
      text.slice(0, MAX_TRANSCRIPT_CHARS) +
      "\n\n[... transcript truncated for length ...]",
    truncated: true,
  };
}
