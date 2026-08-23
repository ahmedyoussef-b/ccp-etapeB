export interface RagContext {
  source: "local" | "vector" | "web" | "database" | "image" | "hybrid";
  content: string;
  metadata?: Record<string, unknown>;
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

export interface RagResult {
  answer: string;
  contexts: RagContext[];
  route: string;
  mediaItems: Array<{
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

export interface RetrievedChunk {
  content: string;
  score: number;
  source: string;
  metadata?: Record<string, unknown>;
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

export interface RouterDecision {
  primary: "local" | "vector" | "web" | "database" | "image";
  secondary?: ("local" | "vector" | "web" | "database" | "image")[];
  reason: string;
}
