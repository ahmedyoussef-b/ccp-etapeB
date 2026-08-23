"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Film, ExternalLink, Play } from "lucide-react";

type MediaItem = {
  id: string;
  title: string;
  category: string;
  kind: "image" | "video";
  mimeType: string;
  dataUrl?: string;
  thumbnailDataUrl?: string;
  description?: string;
  tags?: string[];
};

type ChatMediaRendererProps = {
  mediaItems: MediaItem[];
};

export function ChatMediaRenderer({ mediaItems }: ChatMediaRendererProps) {
  if (!mediaItems || mediaItems.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {mediaItems.map((item) => (
        <Card
          key={item.id}
          className="overflow-hidden rounded-lg border-border/60"
        >
          <div className="flex gap-3 p-2">
            <div className="h-16 w-16 shrink-0 rounded-md overflow-hidden bg-muted/20 flex items-center justify-center">
              {item.kind === "image" && item.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.dataUrl}
                  alt={item.title}
                  className="h-full w-full object-cover"
                />
              ) : item.kind === "video" && item.thumbnailDataUrl ? (
                <div className="relative h-full w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.thumbnailDataUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full bg-black/50 p-1">
                      <Play className="h-3 w-3 text-white" />
                    </div>
                  </div>
                </div>
              ) : (
                item.kind === "image" ? (
                  <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                ) : (
                  <Film className="h-6 w-6 text-muted-foreground/40" />
                )
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {item.title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px] h-4">
                  {item.category}
                </Badge>
                <span className="text-[10px] text-muted-foreground capitalize">
                  {item.kind === "image" ? "Image" : "Vidéo"}
                </span>
              </div>
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {item.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {item.dataUrl && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                title="Ouvrir"
                onClick={() => window.open(item.dataUrl, "_blank")}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
