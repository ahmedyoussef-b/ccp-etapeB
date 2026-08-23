import type { Retriever, RetrievedChunk } from "../base";
import { clientEngine } from "@/lib/client-engine";

export interface MediaRetrievedChunk extends RetrievedChunk {
  mediaItems?: Array<{
    id: string;
    title: string;
    category: string;
    kind: "image" | "video";
    mimeType: string;
    dataUrl?: string;
    thumbnailDataUrl?: string;
    description?: string;
    tags?: string[];
  }>;
}

export class ImageRetriever implements Retriever {
  name = "image";

  async retrieve(query: string, topK = 5): Promise<MediaRetrievedChunk[]> {
    const chunks: MediaRetrievedChunk[] = [];

    try {
      await clientEngine.init();
      const vectorResults = await clientEngine.searchVector(query, topK);

      const imageChunks = vectorResults.filter((r) => {
        const meta = r.metadata as { type?: string } | undefined;
        return meta?.type === "image_metadata";
      });

      if (imageChunks.length > 0) {
        const imageIds = imageChunks
          .map((c) => (c.metadata as { imageId?: string } | undefined)?.imageId)
          .filter((id): id is string => !!id);

        const uniqueIds = Array.from(new Set(imageIds)).slice(0, topK);

        for (const imageId of uniqueIds) {
          try {
            const res = await fetch(`/api/images/${encodeURIComponent(imageId)}`);
            if (res.ok) {
              const item = await res.json();
              const topScore = imageChunks.find(
                (c) => (c.metadata as { imageId?: string } | undefined)?.imageId === imageId
              )?.score ?? 0;

              chunks.push({
                content: `[Média: ${item.title}] ${item.description || ""} ${(item.tags || []).join(" ")} ${item.category} ${item.kind}`,
                score: topScore,
                source: `image://${item.id}`,
                metadata: {
                  type: "image_result",
                  imageId: item.id,
                  title: item.title,
                  category: item.category,
                  kind: item.kind,
                  mimeType: item.mimeType,
                  dataUrl: item.dataUrl,
                  thumbnailDataUrl: item.thumbnailDataUrl,
                  description: item.description,
                  tags: item.tags,
                  size: item.size,
                  createdAt: item.createdAt,
                },
                mediaItems: [
                  {
                    id: item.id,
                    title: item.title,
                    category: item.category,
                    kind: item.kind,
                    mimeType: item.mimeType,
                    dataUrl: item.dataUrl,
                    thumbnailDataUrl: item.thumbnailDataUrl,
                    description: item.description,
                    tags: item.tags,
                  },
                ],
              });
            }
          } catch {
            // skip failed fetch
          }
        }

        return chunks.sort((a, b) => b.score - a.score).slice(0, topK);
      }
    } catch {
      // vector search unavailable
    }

    try {
      const res = await fetch(
        `/api/images/search?q=${encodeURIComponent(query)}&limit=${topK}`
      );
      if (res.ok) {
        const data = await res.json();
        const items = (data.items || []) as Array<{
          id: string;
          title: string;
          category: string;
          kind: "image" | "video";
          mimeType: string;
          dataUrl?: string;
          thumbnailDataUrl?: string;
          description?: string;
          tags?: string[];
          size: number;
          createdAt: string;
        }>;

        for (const item of items) {
          chunks.push({
            content: `[Média: ${item.title}] ${item.description || ""} ${(item.tags || []).join(" ")} ${item.category} ${item.kind}`,
            score: 0.7,
            source: `image://${item.id}`,
            metadata: {
              type: "image_result",
              imageId: item.id,
              title: item.title,
              category: item.category,
              kind: item.kind,
              mimeType: item.mimeType,
              dataUrl: item.dataUrl,
              thumbnailDataUrl: item.thumbnailDataUrl,
              description: item.description,
              tags: item.tags,
              size: item.size,
              createdAt: item.createdAt,
            },
            mediaItems: [
              {
                id: item.id,
                title: item.title,
                category: item.category,
                kind: item.kind,
                mimeType: item.mimeType,
                dataUrl: item.dataUrl,
                thumbnailDataUrl: item.thumbnailDataUrl,
                description: item.description,
                tags: item.tags,
              },
            ],
          });
        }
      }
    } catch {
      // search unavailable
    }

    return chunks.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}

export const imageRetriever = new ImageRetriever();
