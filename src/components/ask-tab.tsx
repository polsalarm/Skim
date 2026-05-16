"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function AskTab({ videoId }: { videoId: string }) {
  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { videoId },
    }),
  });

  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";

  const samples = [
    "What is the main argument?",
    "Summarize the most surprising claim with timestamps.",
    "Are there any actionable next steps?",
  ];

  return (
    <div className="flex flex-col gap-4 min-h-[400px]">
      <div className="flex flex-col gap-3 flex-1">
        {messages.length === 0 && (
          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Ask anything about this video. Answers come from the transcript
              only.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {samples.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage({ text: s })}
                  disabled={busy}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted hover:bg-card transition-colors disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3 items-start",
              message.role === "user" && "flex-row-reverse",
            )}
          >
            <div
              className={cn(
                "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                message.role === "user"
                  ? "bg-muted text-foreground"
                  : "bg-primary text-primary-foreground",
              )}
            >
              {message.role === "user" ? (
                <User size={16} />
              ) : (
                <Sparkles size={16} />
              )}
            </div>
            <div
              className={cn(
                "rounded-lg px-4 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap leading-relaxed",
                message.role === "user"
                  ? "bg-muted"
                  : "bg-card border border-border",
              )}
            >
              {message.parts.map((part, i) =>
                part.type === "text" ? (
                  <span key={i}>{part.text}</span>
                ) : null,
              )}
            </div>
          </div>
        ))}

        {status === "submitted" && (
          <div className="flex gap-3 items-start">
            <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-primary text-primary-foreground">
              <Sparkles size={16} />
            </div>
            <div className="rounded-lg px-4 py-2.5 text-sm bg-card border border-border">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                  style={{ animationDelay: "0.15s" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                  style={{ animationDelay: "0.3s" }}
                />
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Something went wrong. Try again.
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const text = input.trim();
          if (!text || busy) return;
          sendMessage({ text });
          setInput("");
        }}
        className="flex gap-2 sticky bottom-0 bg-background pt-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this video…"
          disabled={busy}
        />
        {busy ? (
          <Button type="button" variant="secondary" onClick={() => stop()}>
            Stop
          </Button>
        ) : (
          <Button type="submit" disabled={!input.trim()}>
            <Send size={16} />
          </Button>
        )}
      </form>
    </div>
  );
}
