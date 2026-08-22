import type { Retriever, RetrievedChunk } from "../base";

type ImageHit = {
  id: string;
  title: string;
  category: string;
  description: string;
  tags: string[];
  kind: "image" | "video";
  mimeType: string;
  size: number;
  score: number;
};

export class ImageRetriever implements Retriever {
  name = "images";

  async retrieve(query: string, topK = 5): Promise<RetrievedChunk[]> {
    try {
      const url = new URL("/api/images/search", "http://localhost");
      url.searchParams.set("q", query);
      url.searchParams.set("limit", String(topK));

      const res = await fetch(url.toString());
      if (!res.ok) return [];

      const data = await res.json();
      const hits = (data.items || []) as ImageHit[];

      return hits.map((hit) => ({
        content: this.buildContent(hit),
        score: this.computeScore(hit, query),
        source: `image://${hit.id}`,
        metadata: {
          type: "media",
          id: hit.id,
          title: hit.title,
          category: hit.category,
          kind: hit.kind,
          mimeType: hit.mimeType,
          tags: hit.tags,
          description: hit.description,
          size: hit.size,
        },
      }));
    } catch {
      return [];
    }
  }

  private buildContent(hit: ImageHit): string {
    const parts = [
      `[Média] ${hit.title}`,
      hit.category ? `Catégorie: ${hit.category}` : null,
      hit.description ? `Description: ${hit.description}` : null,
      hit.tags.length > 0 ? `Tags: ${hit.tags.join(", ")}` : null,
      `Type: ${hit.kind === "image" ? "Image" : "Vidéo"} (${hit.mimeType})`,
    ].filter(Boolean);

    return parts.join("\n");
  }

  private computeScore(hit: ImageHit, query: string): number {
    const q = query.toLowerCase();
    let score = 0.5;

    if (hit.title.toLowerCase().includes(q)) score = Math.max(score, 0.9);
    if (hit.category.toLowerCase().includes(q)) score = Math.max(score, 0.8);
    if (hit.tags.some((t) => t.toLowerCase().includes(q))) score = Math.max(score, 0.8);
    if (hit.description.toLowerCase().includes(q)) score = Math.max(score, 0.7);

    return Math.min(score, 1);
  }
}

export const imageRetriever = new ImageRetriever();
