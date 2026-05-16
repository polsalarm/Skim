import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  extractVideoId,
  fetchMetadata,
  fetchTranscript,
  IngestionError,
  totalDurationSeconds,
  transcriptToPlainText,
  transcriptToTimestampedText,
} from "@/lib/youtube";
import { getCached, setCached, setCachedSource } from "@/lib/cache";
import {
  ANALYSIS_MODEL,
  IS_GOOGLE_PROVIDER,
  truncateTranscript,
} from "@/lib/ai";
import type { AnalysisResult, TranscriptSegment, VideoMetadata } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

const MAX_DURATION_SECONDS = 60 * 60 * 3;

const AnalysisSchema = z.object({
  summary: z.object({
    tldr: z
      .string()
      .describe("A single-sentence TL;DR of the entire video (max 30 words)."),
    overview: z
      .string()
      .describe(
        "A 2-3 paragraph overview that captures the main thesis, key arguments, and conclusion of the video.",
      ),
  }),
  takeaways: z
    .array(
      z.object({
        point: z
          .string()
          .describe("A short, punchy takeaway headline (max 12 words)."),
        detail: z
          .string()
          .describe(
            "A 1-2 sentence elaboration with the most important context or example from the video.",
          ),
      }),
    )
    .min(3)
    .max(10)
    .describe("Between 5 and 8 key takeaways from the video."),
  chapters: z
    .array(
      z.object({
        title: z.string().describe("A descriptive chapter title (max 8 words)."),
        startSeconds: z
          .number()
          .int()
          .nonnegative()
          .describe(
            "Start time in WHOLE SECONDS as an integer from the start of the video.",
          ),
        summary: z
          .string()
          .describe("A 1-2 sentence summary of what is covered in this chapter."),
      }),
    )
    .min(2)
    .max(15)
    .describe(
      "Chapter breakdown with start times in seconds. Cover the entire video. Always start the first chapter at 0.",
    ),
});

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

const SYSTEM_PROMPT = [
  "You are an expert video analyst.",
  "Produce a structured analysis of the video provided.",
  "Rules:",
  "- Base every claim ONLY on the actual content of the video.",
  "- Do NOT invent statistics, names, or quotes that are not in the video.",
  "- Chapter startSeconds MUST be in whole seconds from the start of the video (an integer).",
  "- Always include the very first chapter starting at 0 seconds.",
  "- Write in clear, neutral English. Avoid hype words.",
].join("\n");

/**
 * Path 1: Google Gemini — pass the YouTube URL directly as a file part.
 * Gemini downloads + processes the video itself, so it works on any host
 * (no need for the transcript-scraping fallback that YouTube blocks on
 * datacenter IPs like Vercel's).
 */
async function analyzeWithGemini(metadata: VideoMetadata) {
  const result = await generateText({
    model: ANALYSIS_MODEL,
    output: Output.object({ schema: AnalysisSchema }),
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this YouTube video.\nTitle: ${metadata.title}\nChannel: ${metadata.author}\n\nProduce the structured analysis. Use the actual video timestamps for chapters.`,
          },
          {
            type: "file",
            data: metadata.url,
            mediaType: "video/mp4",
          },
        ],
      },
    ],
  });
  return result.output;
}

/**
 * Path 2: Transcript-based fallback (used when Vercel AI Gateway or another
 * non-Google provider is configured). Requires successful transcript scraping,
 * which often fails on datacenter IPs.
 */
async function analyzeWithTranscript(
  metadata: VideoMetadata,
  transcript: TranscriptSegment[],
) {
  const duration = totalDurationSeconds(transcript);
  const timestamped = transcriptToTimestampedText(transcript);
  const { text: trimmed } = truncateTranscript(timestamped);

  const result = await generateText({
    model: ANALYSIS_MODEL,
    output: Output.object({ schema: AnalysisSchema }),
    system: [
      SYSTEM_PROMPT,
      "- Chapter startSeconds MUST correspond to one of the [mm:ss] markers (convert mm:ss to seconds).",
    ].join("\n"),
    prompt: `Video title: ${metadata.title}
Channel: ${metadata.author}
Approximate length: ${Math.round(duration / 60)} minutes

Transcript (with [mm:ss] markers every ~30s):
${trimmed}

Produce the structured analysis.`,
  });
  return result.output;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body.", 400);
  }

  const url =
    typeof (body as { url?: unknown })?.url === "string"
      ? (body as { url: string }).url
      : null;

  if (!url) {
    return errorResponse("Missing 'url' field.", 400);
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return errorResponse(
      "Couldn't parse a YouTube video ID from that URL.",
      400,
      "INVALID_URL",
    );
  }

  const cached = getCached(videoId);
  if (cached) {
    return NextResponse.json({ ...cached, cached: true });
  }

  // oEmbed call is from a Google service so it works even from datacenter IPs.
  let metadata: VideoMetadata;
  try {
    metadata = await fetchMetadata(videoId);
  } catch (err) {
    if (err instanceof IngestionError) {
      return errorResponse(err.message, err.code === "VIDEO_UNAVAILABLE" ? 404 : 422, err.code);
    }
    console.error("Metadata fetch failed:", err);
    return errorResponse("Failed to fetch video metadata.", 500);
  }

  let analysis;
  let transcriptForCache: TranscriptSegment[] | undefined;

  try {
    if (IS_GOOGLE_PROVIDER) {
      analysis = await analyzeWithGemini(metadata);
    } else {
      const transcript = await fetchTranscript(videoId);
      const duration = totalDurationSeconds(transcript);
      if (duration > MAX_DURATION_SECONDS) {
        return errorResponse(
          `Video is too long (${Math.round(duration / 60)} min). Maximum is ${
            MAX_DURATION_SECONDS / 60
          } minutes for the MVP.`,
          413,
          "TOO_LONG",
        );
      }
      const plain = transcriptToPlainText(transcript);
      if (plain.length < 80) {
        return errorResponse(
          "This transcript is too short to analyze meaningfully.",
          422,
          "NO_TRANSCRIPT",
        );
      }
      transcriptForCache = transcript;
      analysis = await analyzeWithTranscript(metadata, transcript);
    }
  } catch (err) {
    if (err instanceof IngestionError) {
      const status =
        err.code === "VIDEO_UNAVAILABLE"
          ? 404
          : err.code === "RATE_LIMITED"
            ? 429
            : 422;
      return errorResponse(err.message, status, err.code);
    }
    console.error("LLM analysis failed:", err);
    const message = err instanceof Error ? err.message : "Analysis failed.";
    return errorResponse(
      `Analysis failed: ${message}. Check your provider API key and that the video is public.`,
      500,
    );
  }

  setCachedSource(videoId, metadata, transcriptForCache);

  // Clean up chapter timestamps: clamp to non-negative integers, sort, dedupe,
  // ensure the first chapter starts at 0.
  const cleanedChapters = analysis.chapters
    .map((c) => ({ ...c, startSeconds: Math.max(0, Math.floor(c.startSeconds)) }))
    .sort((a, b) => a.startSeconds - b.startSeconds)
    .filter(
      (c, i, arr) => i === 0 || c.startSeconds !== arr[i - 1].startSeconds,
    );

  if (cleanedChapters.length > 0 && cleanedChapters[0].startSeconds > 0) {
    cleanedChapters[0] = { ...cleanedChapters[0], startSeconds: 0 };
  }

  const result: AnalysisResult = {
    metadata,
    transcript: transcriptForCache,
    summary: analysis.summary,
    takeaways: analysis.takeaways,
    chapters: cleanedChapters,
    generatedAt: new Date().toISOString(),
  };

  setCached(videoId, result);

  return NextResponse.json({ ...result, cached: false });
}
