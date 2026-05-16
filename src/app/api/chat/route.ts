import {
  convertToModelMessages,
  streamText,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { getCachedSource } from "@/lib/cache";
import {
  CHAT_MODEL,
  IS_GOOGLE_PROVIDER,
  truncateTranscript,
} from "@/lib/ai";
import { transcriptToTimestampedText } from "@/lib/youtube";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { messages?: UIMessage[]; videoId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { messages, videoId } = body;
  if (!messages || !videoId) {
    return new Response("Missing messages or videoId", { status: 400 });
  }

  const cached = getCachedSource(videoId);
  if (!cached) {
    return new Response(
      "Video metadata not in cache. Analyze the video first.",
      { status: 404 },
    );
  }

  const { metadata, transcript } = cached;
  const modelMessages = await convertToModelMessages(messages);

  let messagesWithContext: ModelMessage[];
  let system: string;

  if (IS_GOOGLE_PROVIDER) {
    // Attach the YouTube URL as a file part — Gemini watches the actual video.
    system = [
      "You are an assistant that answers questions strictly about a single YouTube video.",
      "Rules:",
      "- Base answers ONLY on the video's content.",
      `- If the answer is not in the video, say: "The video doesn't cover that."`,
      "- When referring to specific moments, include the timestamp in [mm:ss] format.",
      "- Be concise. Do not invent facts.",
      "",
      `Video title: ${metadata.title}`,
      `Channel: ${metadata.author}`,
    ].join("\n");

    messagesWithContext = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Here is the YouTube video I will ask questions about. Watch it carefully, then wait for my question.",
          },
          {
            type: "file",
            data: metadata.url,
            mediaType: "video/mp4",
          },
        ],
      },
      {
        role: "assistant",
        content: "Got it — I've watched the video. What would you like to know?",
      },
      ...modelMessages,
    ];
  } else {
    // Fallback transcript path (only works if transcript was successfully scraped).
    if (!transcript) {
      return new Response(
        "No transcript available for this video and no video-capable provider configured. Re-analyze with Google Gemini configured.",
        { status: 422 },
      );
    }
    const timestamped = transcriptToTimestampedText(transcript);
    const { text: trimmed } = truncateTranscript(timestamped);

    system = [
      "You are an assistant that answers questions strictly about a single YouTube video.",
      "You ONLY have access to the transcript below — nothing else.",
      "Rules:",
      `- If the answer is not in the transcript, say: "The video doesn't cover that."`,
      "- When you cite something, include the [mm:ss] timestamp from the transcript.",
      "- Be concise. Quote sparingly. Do not invent facts.",
      "",
      `Video title: ${metadata.title}`,
      `Channel: ${metadata.author}`,
      "",
      "TRANSCRIPT:",
      trimmed,
    ].join("\n");

    messagesWithContext = modelMessages;
  }

  const result = streamText({
    model: CHAT_MODEL,
    system,
    messages: messagesWithContext,
  });

  return result.toUIMessageStreamResponse();
}
