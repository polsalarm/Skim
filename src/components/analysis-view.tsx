"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AskTab } from "@/components/ask-tab";
import { formatTimestamp } from "@/lib/utils";
import type { AnalysisResult } from "@/lib/types";
import { ExternalLink, Lightbulb, ListChecks, MessageSquare, BookText } from "lucide-react";

export function AnalysisView({ result }: { result: AnalysisResult }) {
  const { metadata, summary, takeaways, chapters } = result;

  const ytLink = (seconds: number) =>
    `https://www.youtube.com/watch?v=${metadata.videoId}&t=${Math.floor(seconds)}s`;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col sm:flex-row gap-5 p-5">
          <a
            href={metadata.url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 group relative w-full sm:w-64 aspect-video rounded-lg overflow-hidden bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={metadata.thumbnailUrl}
              alt={metadata.title}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ExternalLink className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={28} />
            </div>
          </a>
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <h2 className="text-xl font-semibold leading-tight line-clamp-3">
              {metadata.title}
            </h2>
            <a
              href={metadata.authorUrl ?? metadata.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
            >
              {metadata.author}
            </a>
            <p className="text-sm leading-relaxed mt-2">{summary.tldr}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">
            <BookText size={14} className="inline mr-1.5 -mt-0.5" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="takeaways">
            <Lightbulb size={14} className="inline mr-1.5 -mt-0.5" />
            Takeaways
          </TabsTrigger>
          <TabsTrigger value="chapters">
            <ListChecks size={14} className="inline mr-1.5 -mt-0.5" />
            Chapters
          </TabsTrigger>
          <TabsTrigger value="ask">
            <MessageSquare size={14} className="inline mr-1.5 -mt-0.5" />
            Ask
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card>
            <CardContent className="p-6 prose-styles">
              <div className="flex flex-col gap-4">
                <div>
                  <Badge className="mb-2">TL;DR</Badge>
                  <p className="text-base leading-relaxed">{summary.tldr}</p>
                </div>
                <div>
                  <Badge className="mb-2">Overview</Badge>
                  <div className="text-base leading-relaxed whitespace-pre-wrap">
                    {summary.overview}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="takeaways">
          <Card>
            <CardContent className="p-2 sm:p-4">
              <ol className="flex flex-col">
                {takeaways.map((t, i) => (
                  <li
                    key={i}
                    className="flex gap-4 p-4 border-b border-border last:border-b-0"
                  >
                    <div className="shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center">
                      {i + 1}
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <p className="font-medium leading-snug">{t.point}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {t.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chapters">
          <Card>
            <CardContent className="p-2 sm:p-4">
              <ol className="flex flex-col">
                {chapters.map((c, i) => (
                  <li
                    key={i}
                    className="flex gap-4 p-4 border-b border-border last:border-b-0"
                  >
                    <a
                      href={ytLink(c.startSeconds)}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 font-mono text-xs px-2.5 py-1.5 h-fit rounded-md bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      {formatTimestamp(c.startSeconds)}
                    </a>
                    <div className="flex flex-col gap-1 min-w-0">
                      <a
                        href={ytLink(c.startSeconds)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium leading-snug hover:text-primary transition-colors group inline-flex items-start gap-1"
                      >
                        {c.title}
                        <ExternalLink
                          size={12}
                          className="opacity-0 group-hover:opacity-60 mt-1 shrink-0"
                        />
                      </a>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {c.summary}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ask">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <AskTab videoId={metadata.videoId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
