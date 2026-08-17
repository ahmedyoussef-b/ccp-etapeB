import type { RagContext, RetrievedChunk } from "./types";

export { RetrievedChunk };

export interface Retriever {
  name: string;
  retrieve(query: string, topK?: number): Promise<RetrievedChunk[]>;
}

export function chunksToContext(chunks: RetrievedChunk[]): RagContext {
  const sorted = chunks.sort((a, b) => b.score - a.score);
  const content = sorted
    .map((c) => `[${c.source}] ${c.content}`)
    .join("\n\n");
  const metadata: Record<string, unknown> = {
    chunkCount: chunks.length,
    topScore: sorted[0]?.score ?? 0,
  };
  return {
    source: "hybrid",
    content,
    metadata,
  };
}
