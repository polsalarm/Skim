import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { getCachedTranscript } from "@/lib/cache";
import { CHAT_MODEL, truncateTranscript } from "@/lib/ai";
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

  const cached = getCachedTranscript(videoId);
  if (!cached) {
    return new Response(
      "Transcript not in cache. Analyze the video first.",
      { status: 404 },
    );
  }

  const { metadata, transcript } = cached;
  const timestamped = transcriptToTimestampedText(transcript);
  const { text: trimmed } = truncateTranscript(timestamped);

  const system = [
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

  const result = streamText({
    model: CHAT_MODEL,
    system,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
