import { simpleTokenEmbedding } from '@/lib/client-engine/vector-store';

const EMBEDDING_ENDPOINTS = {
  azure: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    deployment: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    apiVersion: '2024-02-15-preview',
  },
  groq: {
    endpoint: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY,
  },
};

const PLACEHOLDER_KEYS = new Set([
  'change_me_groq_api_key',
  'change_me_azure_openai_api_key',
  'your_api_key_here',
  'placeholder',
  'changeme',
]);

function isPlaceholderKey(key: string | undefined): boolean {
  if (!key) return true;
  if (PLACEHOLDER_KEYS.has(key.toLowerCase().trim())) return true;
  if (key.length < 16) return true;
  return false;
}

const logger = {
  embedding: (action: string, data?: unknown) =>
    console.log(`[LLM:EMBEDDING] ${action}`, data ? JSON.stringify(data, null, 2) : ''),
  embeddingError: (action: string, error: unknown) =>
    console.error(`[LLM:EMBEDDING] [ERROR] ${action}`, error instanceof Error ? error.message : String(error)),
};

export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  model: string;
  fallback: boolean;
}

export async function embed(text: string): Promise<number[]> {
  const result = await embedWithMeta(text);
  return result.embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  try {
    if (!isPlaceholderKey(EMBEDDING_ENDPOINTS.azure.apiKey) && EMBEDDING_ENDPOINTS.azure.endpoint && EMBEDDING_ENDPOINTS.azure.deployment) {
      return await callAzureBatch(texts);
    }

    if (!isPlaceholderKey(EMBEDDING_ENDPOINTS.groq.apiKey) && EMBEDDING_ENDPOINTS.groq.endpoint) {
      return await callGroqBatch(texts);
    }

    throw new Error('No embedding API key configured');
  } catch (error) {
    logger.embeddingError('embedBatch_api_failed', error);
    logger.embedding('embedBatch_fallback_local', { count: texts.length });
    return texts.map(t => simpleTokenEmbedding(t));
  }
}

async function embedWithMeta(text: string): Promise<EmbeddingResult> {
  try {
    if (!isPlaceholderKey(EMBEDDING_ENDPOINTS.azure.apiKey) && EMBEDDING_ENDPOINTS.azure.endpoint && EMBEDDING_ENDPOINTS.azure.deployment) {
      const embedding = await callAzureSingle(text);
      return { embedding, dimensions: embedding.length, model: 'text-embedding-3-small', fallback: false };
    }

    if (!isPlaceholderKey(EMBEDDING_ENDPOINTS.groq.apiKey) && EMBEDDING_ENDPOINTS.groq.endpoint) {
      const embedding = await callGroqSingle(text);
      return { embedding, dimensions: embedding.length, model: 'groq-embedding', fallback: false };
    }

    throw new Error('No embedding API key configured');
  } catch (error) {
    logger.embeddingError('embed_api_failed', error);
    const fallback = simpleTokenEmbedding(text);
    return { embedding: fallback, dimensions: fallback.length, model: 'simple-token-hash', fallback: true };
  }
}

async function callAzureSingle(text: string): Promise<number[]> {
  const { endpoint, apiKey, deployment, apiVersion } = EMBEDDING_ENDPOINTS.azure;
  const url = `${endpoint!.replace(/\/$/, '')}/openai/deployments/${deployment}/embeddings?api-version=${apiVersion}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey!,
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-3-small',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Azure embedding error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.data?.[0]?.embedding || [];
}

async function callAzureBatch(texts: string[]): Promise<number[][]> {
  const { endpoint, apiKey, deployment, apiVersion } = EMBEDDING_ENDPOINTS.azure;
  const url = `${endpoint!.replace(/\/$/, '')}/openai/deployments/${deployment}/embeddings?api-version=${apiVersion}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey!,
    },
    body: JSON.stringify({
      input: texts,
      model: 'text-embedding-3-small',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Azure embedding error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.data?.map((d: { embedding: number[] }) => d.embedding) || [];
}

async function callGroqSingle(text: string): Promise<number[]> {
  const { endpoint, apiKey } = EMBEDDING_ENDPOINTS.groq;
  const url = `${endpoint}/embeddings`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey ?? ''}`,
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-3-small',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq embedding error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.data?.[0]?.embedding || [];
}

async function callGroqBatch(texts: string[]): Promise<number[][]> {
  const { endpoint, apiKey } = EMBEDDING_ENDPOINTS.groq;
  const url = `${endpoint}/embeddings`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey ?? ''}`,
    },
    body: JSON.stringify({
      input: texts,
      model: 'text-embedding-3-small',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq embedding error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.data?.map((d: { embedding: number[] }) => d.embedding) || [];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const minLen = Math.min(a.length, b.length);
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < minLen; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}
