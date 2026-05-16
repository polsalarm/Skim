# Skim — AI YouTube Video Analyzer

Paste a YouTube URL → get an AI-powered summary, key takeaways, a clickable
chapter breakdown, and a chat that answers questions strictly from the
transcript.

Built as a weekend MVP with Next.js 16, the Vercel AI SDK v6, and the YouTube
auto-caption transcript.

## Features

- **URL ingestion** — paste any YouTube URL (`watch`, `shorts`, `youtu.be`,
  `embed`, or a raw 11-char video ID)
- **Metadata** via the YouTube oEmbed endpoint (no API key required)
- **Transcripts** via [`youtube-transcript`](https://www.npmjs.com/package/youtube-transcript)
  (auto-captions only — videos without captions are gracefully rejected)
- **AI analysis** with structured output (Zod schema + `generateText` + `Output.object`):
  - TL;DR + multi-paragraph overview
  - 5–8 key takeaways
  - 2–15 chapter breakdown with **clickable timestamps** that deep-link back
    to `youtube.com/watch?v=ID&t=Xs`
- **Q&A** — streaming chat (`useChat` + `DefaultChatTransport`) constrained
  to the transcript only
- **In-memory cache** keyed by video ID (7-day TTL) — same URL = instant repeat
- Clean, responsive UI with dark mode via `prefers-color-scheme`

## Stack

| Layer       | Tech                                            |
| ----------- | ----------------------------------------------- |
| Framework   | Next.js 16 (App Router) + React 19              |
| Styling     | Tailwind CSS v4                                 |
| LLM         | Vercel AI SDK v6 (plain string model IDs route through AI Gateway) |
| Transcripts | `youtube-transcript`                            |
| Metadata    | YouTube oEmbed                                  |
| Cache       | In-memory `Map` (swap for Vercel KV for prod)   |
| Icons       | `lucide-react`                                  |

## Getting started

```bash
npm install
cp .env.example .env.local
# fill in AI_GATEWAY_API_KEY
npm run dev
```

Open <http://localhost:3000>.

### Environment

| Variable             | Required | Notes                                                          |
| -------------------- | -------- | -------------------------------------------------------------- |
| `AI_GATEWAY_API_KEY` | yes      | Vercel AI Gateway key. Required for the LLM calls.             |
| `AI_MODEL`           | no       | Defaults to `openai/gpt-5-mini`. Used for structured analysis. |
| `AI_CHAT_MODEL`      | no       | Defaults to `AI_MODEL`. Used for the Q&A tab.                  |

## Project structure

```
src/
  app/
    api/
      analyze/route.ts   # POST { url } → full analysis JSON
      chat/route.ts      # POST { messages, videoId } → streaming Q&A
    page.tsx             # main UI
    layout.tsx
    globals.css
  components/
    analysis-view.tsx    # tabbed result view
    ask-tab.tsx          # streaming chat tab
    loading-state.tsx
    ui/                  # minimal Button/Card/Tabs/Input/Skeleton/Badge
  lib/
    youtube.ts           # extractVideoId, oEmbed, transcript fetch + normalize
    cache.ts             # in-memory caches (analysis + transcript)
    ai.ts                # model config + truncation
    types.ts
    utils.ts             # cn() + formatTimestamp()
```

## Known limitations (weekend MVP)

- **Captions required.** Videos with disabled or missing auto-captions return
  a friendly error. A v2 could add Whisper fallback by downloading audio.
- **3-hour cap.** Anything longer is rejected to keep prompt size and LLM
  cost predictable. Bump `MAX_DURATION_SECONDS` in `analyze/route.ts` to
  raise.
- **Transcript truncation.** Anything past ~120k characters is truncated;
  for very long videos consider chunked map-reduce summarization.
- **In-memory cache.** Resets on deploy/restart. Swap for Vercel KV /
  Upstash Redis for persistence.
- **No auth or per-user rate limits.** Add before going public — your AI
  Gateway bill is exposed otherwise.

## Roadmap ideas

- Whisper fallback for videos without captions
- Chunked map-reduce for 3h+ content
- User accounts + saved analyses + share links
- Export to Markdown / Notion / PDF
- Playlist or channel batch mode
- Per-IP / per-user rate limiting + abuse protection
- Streaming the structured analysis with `streamText` + `partialOutputStream`

## License

MIT.
