import type { AnalysisResult, TranscriptSegment, VideoMetadata } from "./types";

type CacheEntry = AnalysisResult & { expiresAt: number };

const TTL_MS = 1000 * 60 * 60 * 24 * 7;
const store = new Map<string, CacheEntry>();

export function getCached(videoId: string): AnalysisResult | null {
  const entry = store.get(videoId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(videoId);
    return null;
  }
  return entry;
}

export function setCached(videoId: string, result: AnalysisResult): void {
  store.set(videoId, { ...result, expiresAt: Date.now() + TTL_MS });
}

type SourceCacheEntry = {
  metadata: VideoMetadata;
  transcript?: TranscriptSegment[];
  expiresAt: number;
};
const sourceStore = new Map<string, SourceCacheEntry>();

export function getCachedSource(
  videoId: string,
): { metadata: VideoMetadata; transcript?: TranscriptSegment[] } | null {
  const entry = sourceStore.get(videoId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    sourceStore.delete(videoId);
    return null;
  }
  return { metadata: entry.metadata, transcript: entry.transcript };
}

export function setCachedSource(
  videoId: string,
  metadata: VideoMetadata,
  transcript?: TranscriptSegment[],
): void {
  sourceStore.set(videoId, {
    metadata,
    transcript,
    expiresAt: Date.now() + TTL_MS,
  });
}
