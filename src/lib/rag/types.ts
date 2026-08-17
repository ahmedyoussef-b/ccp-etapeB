export interface RagContext {
  source: "local" | "vector" | "web" | "database" | "hybrid";
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RagResult {
  answer: string;
  contexts: RagContext[];
  route: string;
}

export interface RetrievedChunk {
  content: string;
  score: number;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface RouterDecision {
  primary: "local" | "vector" | "web" | "database";
  secondary?: ("local" | "vector" | "web" | "database")[];
  reason: string;
}
