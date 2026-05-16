export type TranscriptSegment = {
  text: string;
  start: number;
  duration: number;
};

export type VideoMetadata = {
  videoId: string;
  title: string;
  author: string;
  authorUrl?: string;
  thumbnailUrl: string;
  url: string;
};

export type Takeaway = {
  point: string;
  detail: string;
};

export type Chapter = {
  title: string;
  startSeconds: number;
  summary: string;
};

export type AnalysisResult = {
  metadata: VideoMetadata;
  transcript?: TranscriptSegment[];
  summary: {
    tldr: string;
    overview: string;
  };
  takeaways: Takeaway[];
  chapters: Chapter[];
  generatedAt: string;
};
