import type { Retriever, RetrievedChunk } from "../base";
import { searchPairs, searchItemsByFilename } from "@/lib/qr/client-store";
import type { QAResult } from "@/lib/qr/client-store";

export class LocalRetriever implements Retriever {
  name = "local";

  async retrieve(query: string, topK = 5): Promise<RetrievedChunk[]> {
    let pairResults: QAResult[] = [];
    let itemResults: Awaited<ReturnType<typeof searchItemsByFilename>> = [];

    try {
      pairResults = await searchPairs(query, topK);
    } catch {
      pairResults = [];
    }

    try {
      itemResults = await searchItemsByFilename(query, topK);
    } catch {
      itemResults = [];
    }

    const chunks: RetrievedChunk[] = [];

    for (const r of pairResults) {
      chunks.push({
        content: `Q: ${r.question}\nR: ${r.answer}`,
        score: r.score,
        source: "qa-db",
        metadata: { type: "qa-pair" },
      });
    }

    for (const item of itemResults) {
      const text = item.pairs
        .slice(0, topK)
        .map((p) => `Q: ${p.question}\nR: ${p.answer}`)
        .join("\n\n");
      chunks.push({
        content: `[Fichier: ${item.filename}]\n${text}`,
        score: item.score,
        source: `items/${item.filename}`,
        metadata: { type: "item-file", filename: item.filename },
      });
    }

    return chunks.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}

export const localRetriever = new LocalRetriever();
