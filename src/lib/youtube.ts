import { YoutubeTranscript } from "youtube-transcript";
import type { TranscriptSegment, VideoMetadata } from "./types";

const YOUTUBE_ID_REGEX =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export class IngestionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_URL"
      | "VIDEO_UNAVAILABLE"
      | "NO_TRANSCRIPT"
      | "TOO_LONG"
      | "RATE_LIMITED"
      | "UNKNOWN",
  ) {
    super(message);
    this.name = "IngestionError";
  }
}

export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(YOUTUBE_ID_REGEX);
  return match?.[1] ?? null;
}

export async function fetchMetadata(videoId: string): Promise<VideoMetadata> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    watchUrl,
  )}&format=json`;

  const res = await fetch(oembedUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; VideoAnalysisBot/1.0)" },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 404) {
    throw new IngestionError(
      "This video is private, deleted, or doesn't exist.",
      "VIDEO_UNAVAILABLE",
    );
  }

  if (!res.ok) {
    throw new IngestionError(
      `Failed to fetch video metadata (HTTP ${res.status}).`,
      "UNKNOWN",
    );
  }

  const data = (await res.json()) as {
    title?: string;
    author_name?: string;
    author_url?: string;
    thumbnail_url?: string;
  };

  return {
    videoId,
    title: data.title ?? "Untitled",
    author: data.author_name ?? "Unknown",
    authorUrl: data.author_url,
    thumbnailUrl:
      data.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    url: watchUrl,
  };
}

/**
 * youtube-transcript v1.3.x returns offsets in either seconds (classic format)
 * or milliseconds (srv3 format). Normalize to seconds.
 */
function normalizeSegments(
  raw: Array<{ text: string; offset: number; duration: number }>,
): TranscriptSegment[] {
  if (raw.length === 0) return [];

  const maxOffset = raw[raw.length - 1].offset;
  const looksLikeMs = maxOffset > 86_400;
  const divisor = looksLikeMs ? 1000 : 1;

  return raw.map((s) => ({
    text: s.text.replace(/\s+/g, " ").trim(),
    start: s.offset / divisor,
    duration: s.duration / divisor,
  }));
}

export async function fetchTranscript(
  videoId: string,
): Promise<TranscriptSegment[]> {
  try {
    const raw = await YoutubeTranscript.fetchTranscript(videoId);
    if (!raw || raw.length === 0) {
      throw new IngestionError(
        "This video has no transcript available.",
        "NO_TRANSCRIPT",
      );
    }
    return normalizeSegments(raw);
  } catch (err) {
    if (err instanceof IngestionError) throw err;
    const name = (err as { name?: string }).name ?? "";
    const message = (err as Error).message ?? String(err);
    if (name.includes("TooManyRequest")) {
      throw new IngestionError(
        "YouTube is rate-limiting us. Try again in a minute.",
        "RATE_LIMITED",
      );
    }
    if (name.includes("Disabled") || /disabled/i.test(message)) {
      throw new IngestionError(
        "Captions are disabled on this video.",
        "NO_TRANSCRIPT",
      );
    }
    if (name.includes("NotAvailable") || /no transcript/i.test(message)) {
      throw new IngestionError(
        "This video has no captions to analyze.",
        "NO_TRANSCRIPT",
      );
    }
    if (name.includes("Unavailable")) {
      throw new IngestionError(
        "This video is unavailable.",
        "VIDEO_UNAVAILABLE",
      );
    }
    throw new IngestionError(
      `Could not fetch transcript: ${message}`,
      "UNKNOWN",
    );
  }
}

export function transcriptToPlainText(segments: TranscriptSegment[]): string {
  return segments.map((s) => s.text).join(" ");
}

export function transcriptToTimestampedText(
  segments: TranscriptSegment[],
  chunkSeconds = 30,
): string {
  if (segments.length === 0) return "";

  const lines: string[] = [];
  let bucketStart = segments[0].start;
  let bucketText: string[] = [];

  const flush = () => {
    if (bucketText.length === 0) return;
    const mm = Math.floor(bucketStart / 60);
    const ss = Math.floor(bucketStart % 60)
      .toString()
      .padStart(2, "0");
    lines.push(`[${mm}:${ss}] ${bucketText.join(" ")}`);
    bucketText = [];
  };

  for (const seg of segments) {
    if (seg.start - bucketStart >= chunkSeconds) {
      flush();
      bucketStart = seg.start;
    }
    bucketText.push(seg.text);
  }
  flush();
  return lines.join("\n");
}

export function totalDurationSeconds(segments: TranscriptSegment[]): number {
  if (segments.length === 0) return 0;
  const last = segments[segments.length - 1];
  return last.start + last.duration;
}
