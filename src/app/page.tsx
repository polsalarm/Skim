"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { AnalysisView } from "@/components/analysis-view";
import { LoadingState } from "@/components/loading-state";
import { Sparkles, AlertTriangle, CirclePlay } from "lucide-react";
import type { AnalysisResult } from "@/lib/types";

type State =
  | { kind: "idle" }
  | { kind: "loading"; url: string }
  | { kind: "error"; message: string; code?: string }
  | { kind: "ready"; result: AnalysisResult };

export default function Home() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setState({ kind: "loading", url: trimmed });

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const json = await res.json();

      if (!res.ok) {
        setState({
          kind: "error",
          message: json.error ?? "Something went wrong.",
          code: json.code,
        });
        return;
      }

      setState({ kind: "ready", result: json });
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Network error. Please retry.",
      });
    }
  }

  const busy = state.kind === "loading";

  return (
    <main className="min-h-screen w-full flex flex-col">
      <div className="absolute inset-x-0 top-0 h-[40vh] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent pointer-events-none -z-10" />

      <div className="container mx-auto max-w-3xl px-4 py-12 sm:py-20 flex flex-col gap-10 flex-1">
        <header className="flex flex-col items-center gap-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card text-xs font-medium">
            <Sparkles size={12} className="text-primary" />
            <span>AI-powered video analysis</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Skim any YouTube video
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              in seconds.
            </span>
          </h1>
          <p className="text-base text-muted-foreground max-w-xl">
            Paste a URL. Get a summary, the key takeaways, a clickable chapter
            breakdown, and a chat that answers questions from the transcript.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <CirclePlay
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={busy}
              className="pl-10 h-12 text-base"
              autoFocus
            />
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={busy || !url.trim()}
            className="sm:w-auto"
          >
            {busy ? "Analyzing…" : "Analyze"}
            <Sparkles size={16} />
          </Button>
        </form>

        {state.kind === "idle" && (
          <Card>
            <CardContent className="p-6 flex flex-col gap-2">
              <p className="text-sm font-medium">Try one of these:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.url}
                    onClick={() => setUrl(ex.url)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted hover:bg-card transition-colors"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Works with any YouTube video that has captions enabled.
              </p>
            </CardContent>
          </Card>
        )}

        {state.kind === "loading" && <LoadingState />}

        {state.kind === "error" && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex gap-3 p-5">
              <AlertTriangle
                size={20}
                className="text-destructive shrink-0 mt-0.5"
              />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-destructive">
                  Couldn&apos;t analyze this video
                </p>
                <p className="text-sm text-muted-foreground">{state.message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {state.kind === "ready" && <AnalysisView result={state.result} />}
      </div>

      <footer className="border-t border-border py-6 mt-12">
        <div className="container mx-auto max-w-3xl px-4 text-xs text-muted-foreground flex justify-between">
          <span>Skim · weekend MVP</span>
          <a
            href="https://github.com"
            className="hover:text-foreground transition-colors"
          >
            Source
          </a>
        </div>
      </footer>
    </main>
  );
}

const EXAMPLES = [
  {
    label: "Steve Jobs · Stanford '05",
    url: "https://www.youtube.com/watch?v=UF8uR6Z6KLc",
  },
  {
    label: "Tim Urban · TED Talk",
    url: "https://www.youtube.com/watch?v=arj7oStGLkU",
  },
  {
    label: "Andrej Karpathy · LLM intro",
    url: "https://www.youtube.com/watch?v=zjkBMFhNj_g",
  },
];
