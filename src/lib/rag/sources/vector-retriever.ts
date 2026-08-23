import type { Retriever, RetrievedChunk } from "../base";
import { clientEngine } from "@/lib/client-engine";

export class VectorRetriever implements Retriever {
  name = "vector";

  async retrieve(query: string, topK = 5): Promise<RetrievedChunk[]> {
    return clientEngine.searchVector(query, topK);
  }
}

export const vectorRetriever = new VectorRetriever();
