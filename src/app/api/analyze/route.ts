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
import {
  getCached,
  setCached,
  setCachedTranscript,
} from "@/lib/cache";
import { ANALYSIS_MODEL, truncateTranscript } from "@/lib/ai";
import type { AnalysisResult } from "@/lib/types";

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
            "Start time in WHOLE SECONDS as an integer. Must come from the [mm:ss] markers in the transcript.",
          ),
        summary: z
          .string()
          .describe("A 1-2 sentence summary of what is covered in this chapter."),
      }),
    )
    .min(2)
    .max(15)
    .describe(
      "Chapter breakdown with start times. Cover the entire video. Use the [mm:ss] timestamps from the transcript.",
    ),
});

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
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

  let metadata, transcript;
  try {
    [metadata, transcript] = await Promise.all([
      fetchMetadata(videoId),
      fetchTranscript(videoId),
    ]);
  } catch (err) {
    if (err instanceof IngestionError) {
      const status =
        err.code === "INVALID_URL" || err.code === "VIDEO_UNAVAILABLE"
          ? 404
          : err.code === "RATE_LIMITED"
            ? 429
            : 422;
      return errorResponse(err.message, status, err.code);
    }
    console.error("Ingestion failed:", err);
    return errorResponse("Failed to fetch video data.", 500);
  }

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

  setCachedTranscript(videoId, metadata, transcript);

  const timestamped = transcriptToTimestampedText(transcript);
  const { text: trimmed } = truncateTranscript(timestamped);

  const plain = transcriptToPlainText(transcript);
  if (plain.length < 80) {
    return errorResponse(
      "This transcript is too short to analyze meaningfully.",
      422,
      "NO_TRANSCRIPT",
    );
  }

  let analysis;
  try {
    const result = await generateText({
      model: ANALYSIS_MODEL,
      output: Output.object({ schema: AnalysisSchema }),
      system: [
        "You are an expert video analyst.",
        "Given a YouTube transcript with [mm:ss] markers, produce a structured analysis.",
        "Rules:",
        "- Base every claim ONLY on the transcript content provided.",
        "- Do NOT invent statistics, names, or quotes that are not in the transcript.",
        "- Chapter startSeconds MUST correspond to one of the [mm:ss] markers (convert mm:ss to seconds).",
        "- Always include the very first chapter starting at 0 seconds.",
        "- Write in clear, neutral English. Avoid hype words.",
      ].join("\n"),
      prompt: `Video title: ${metadata.title}
Channel: ${metadata.author}
Approximate length: ${Math.round(duration / 60)} minutes

Transcript (with [mm:ss] markers every ~30s):
${trimmed}

Produce the structured analysis.`,
    });
    analysis = result.output;
  } catch (err) {
    console.error("LLM analysis failed:", err);
    const message = err instanceof Error ? err.message : "Analysis failed.";
    return errorResponse(
      `Analysis failed: ${message}. Check AI_GATEWAY_API_KEY or AI_MODEL env vars.`,
      500,
    );
  }

  const totalSec = Math.floor(duration);
  const cleanedChapters = analysis.chapters
    .map((c) => ({
      ...c,
      startSeconds: Math.min(Math.max(0, Math.floor(c.startSeconds)), totalSec),
    }))
    .sort((a, b) => a.startSeconds - b.startSeconds)
    .filter(
      (c, i, arr) => i === 0 || c.startSeconds !== arr[i - 1].startSeconds,
    );

  if (cleanedChapters.length > 0 && cleanedChapters[0].startSeconds > 0) {
    cleanedChapters[0] = { ...cleanedChapters[0], startSeconds: 0 };
  }

  const result: AnalysisResult = {
    metadata,
    transcript,
    summary: analysis.summary,
    takeaways: analysis.takeaways,
    chapters: cleanedChapters,
    generatedAt: new Date().toISOString(),
  };

  setCached(videoId, result);

  return NextResponse.json({ ...result, cached: false });
}
