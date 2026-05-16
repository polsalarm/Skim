# Skim — AI YouTube Video Analyzer

Paste a YouTube URL → get an AI-powered summary, key takeaways, a clickable
chapter breakdown, and a chat that answers questions about the video.

Built as a weekend MVP with Next.js 16, the Vercel AI SDK v6, and Google
Gemini's native YouTube understanding.

## How it works

When you submit a URL, the app:

1. Extracts the YouTube video ID and fetches lightweight metadata (title,
   channel, thumbnail) via the **YouTube oEmbed endpoint** — no API key,
   no quota, works from any IP.
2. Passes the YouTube URL **directly to Google Gemini** as a file part.
   Gemini downloads the video on Google's infrastructure and watches it
   itself — no transcript scraping required.
3. Asks Gemini for a structured JSON object (summary + takeaways +
   chapters with real timestamps) using a Zod schema with
   `generateText` + `Output.object`.
4. Caches the result in memory keyed by video ID (7-day TTL) so repeats
   are instant.
5. Exposes a streaming Q&A chat that re-attaches the same YouTube URL
   so Gemini can answer follow-ups from the same video.

### Why pass the URL to Gemini instead of scraping a transcript?

YouTube aggressively blocks the InnerTube/captions endpoints when the
request comes from a datacenter IP (Vercel, AWS, GCP, etc.). Every
"scrape captions" library breaks the moment you deploy it. Gemini's
native YouTube support sidesteps the problem entirely — and as a bonus
it works on videos without captions (uses ASR) and extracts real
timestamps from the video itself.

A transcript-scraping fallback path is still in the code for use with
non-Google providers — it only works reliably from residential IPs
(i.e. local dev).

## Features

- **URL ingestion** — `watch`, `shorts`, `youtu.be`, `embed`, `live`, or
  a raw 11-char video ID
- **AI analysis** with structured output:
  - TL;DR + multi-paragraph overview
  - 5–8 key takeaways
  - 2–15 chapters with **clickable timestamps** that deep-link back to
    `youtube.com/watch?v=ID&t=Xs`
- **Streaming Q&A** — ask anything about the video, answered from the
  video itself (using `useChat` + `DefaultChatTransport`)
- **In-memory cache** keyed by video ID — same URL = instant repeat
- **Auto-provider switching** — set `GOOGLE_GENERATIVE_AI_API_KEY` and
  it uses Gemini; set `AI_GATEWAY_API_KEY` instead and it uses Vercel
  AI Gateway with transcript fallback
- Clean, responsive UI with dark mode via `prefers-color-scheme`

## Stack

| Layer       | Tech                                                |
| ----------- | --------------------------------------------------- |
| Framework   | Next.js 16 (App Router) + React 19                  |
| Styling     | Tailwind CSS v4                                     |
| LLM         | Vercel AI SDK v6 + `@ai-sdk/google` (Gemini)        |
| Video input | Gemini native YouTube file parts                    |
| Transcripts | `youtube-transcript` (fallback for non-Google only) |
| Metadata    | YouTube oEmbed                                      |
| Cache       | In-memory `Map` (swap for Vercel KV for prod)       |
| Icons       | `lucide-react`                                      |

## Getting started

```bash
git clone https://github.com/polsalarm/Skim.git
cd Skim
npm install
cp .env.example .env.local
# Paste your Google Gemini key into .env.local
npm run dev
```

Open <http://localhost:3000>.

### Get a free Gemini key

1. Go to <https://aistudio.google.com/apikey>
2. Sign in with any Google account
3. Click **Create API key** → copy it (starts with `AIza…`)

No credit card. The free tier on `gemini-2.5-flash` is 10 req/min
and 250 req/day — plenty for testing.

### Environment

Set **one** of these:

| Variable                          | Purpose                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY`    | **Recommended.** Google Gemini direct. Enables native YouTube support.                |
| `AI_GATEWAY_API_KEY`              | Vercel AI Gateway (OpenAI/Anthropic/etc.). Forces transcript-scraping fallback.       |

Optional overrides:

| Variable          | Default              | Notes                              |
| ----------------- | -------------------- | ---------------------------------- |
| `AI_MODEL`        | `gemini-2.5-flash`   | Model used for the structured analysis |
| `AI_CHAT_MODEL`   | (same as AI_MODEL)   | Model used for the Q&A tab         |

## Deploying to Vercel

1. Push the repo to GitHub.
2. <https://vercel.com/new> → **Import** the repo.
3. **Add the env var** `GOOGLE_GENERATIVE_AI_API_KEY` in the Environment
   Variables section before clicking Deploy.
4. Deploy.

The Gemini path works fine on Vercel because Google's servers
(not Vercel's) talk to YouTube.

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
    analysis-view.tsx    # tabbed result view (Summary | Takeaways | Chapters | Ask)
    ask-tab.tsx          # streaming Q&A
    loading-state.tsx
    ui/                  # minimal Button/Card/Tabs/Input/Skeleton/Badge
  lib/
    youtube.ts           # extractVideoId, oEmbed, transcript fallback + normalize
    cache.ts             # in-memory caches (analysis + source metadata)
    ai.ts                # provider auto-detection (Gemini vs Gateway)
    types.ts
    utils.ts             # cn() + formatTimestamp()
```

## Known limitations (weekend MVP)

- **Video length and Gemini cost.** Gemini bills by video tokens
  (~258 tokens per second of low-res video). A 30-minute video is
  ~450k tokens; a 1-hour video is ~900k. This eats free-tier quotas
  fast. Use `AI_MODEL=gemini-2.5-flash-lite` for cheaper runs.
- **60-second function timeout** on Vercel Hobby. Very long videos
  may time out. Lower `MAX_DURATION_SECONDS` in `analyze/route.ts`
  if you want to enforce a hard cap.
- **In-memory cache** doesn't survive between serverless container
  starts. Swap for Vercel KV / Upstash Redis for real persistence.
- **No auth or per-user rate limits.** Don't expose publicly — your
  Gemini quota / bill is otherwise unbounded.
- **Transcript fallback only works locally.** If you use the
  Gateway/OpenAI path, the YouTube transcript scrape will fail on
  any deployed host. Stay on Gemini for production.

## Roadmap ideas

- Replace in-memory cache with Vercel KV (persists across cold starts
  and across users)
- Per-IP / per-user rate limiting
- Share links for individual analyses (read-only public URLs)
- Streaming the structured analysis with `streamText` +
  `partialOutputStream` so takeaways pop in progressively
- Export to Markdown / Notion / PDF
- Playlist or channel batch mode
- User accounts + saved history

## License

MIT.
