import { clientEngine } from './index';

const SEED_FLAG = 'nexaflow_seeded';
const SEED_BASE = '/seed';

export async function seedIfNeeded(): Promise<{ seeded: boolean; files: string[] }> {
  if (typeof window === 'undefined') return { seeded: false, files: [] };

  try {
    const alreadySeeded = window.localStorage.getItem(SEED_FLAG);
    if (alreadySeeded) return { seeded: false, files: [] };
  } catch {
    // ignore
  }

  const results: string[] = [];
  const qaPairs: Array<{ question: string; answer: string }> = [];

  try {
    const res = await fetch(`${SEED_BASE}/qa.json`);
    if (res.ok) {
      const data = await res.json();
      const pairs = Array.isArray(data) ? data : data.pairs || [];
      for (const pair of pairs) {
        if (pair.question && pair.answer) {
          qaPairs.push({ question: pair.question.trim(), answer: pair.answer.trim() });
        }
      }
      results.push('qa.json');
    }
  } catch {
    // ignore missing seed file
  }

  try {
    const res = await fetch(`${SEED_BASE}/documents.json`);
    if (res.ok) {
      const data = await res.json();
      const docs = Array.isArray(data) ? data : data.documents || [];
      for (const doc of docs) {
        if (doc.id && doc.chunks && Array.isArray(doc.chunks)) {
          await clientEngine.addVectorDocument({
            id: doc.id,
            name: doc.name || doc.id,
            originalPath: doc.originalPath || doc.id,
            relativePath: doc.relativePath || doc.id,
            chunks: doc.chunks.map((chunk: { content: string; embedding?: number[]; metadata?: Record<string, unknown> }, idx: number) => ({
              documentId: doc.id,
              documentName: doc.name || doc.id,
              chunkIndex: idx,
              content: chunk.content,
              embedding: Array.isArray(chunk.embedding) ? chunk.embedding : [],
              metadata: chunk.metadata || {},
            })),
            metadata: doc.metadata || {},
          });
        }
      }
      results.push('documents.json');
    }
  } catch {
    // ignore missing seed file
  }

  if (qaPairs.length > 0) {
    for (const pair of qaPairs) {
      await clientEngine.createQAPair(pair);
    }
  }

  try {
    window.localStorage.setItem(SEED_FLAG, '1');
  } catch {
    // ignore
  }

  return { seeded: results.length > 0, files: results };
}
