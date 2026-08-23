import { clientEngine } from '@/lib/client-engine';

export interface QARegistryRecord {
  id: number;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QAPairRecord {
  id: number;
  question: string;
  answer: string;
  registryId: number;
  createdAt: string;
  updatedAt: string;
}

export interface QAPairWithRegistry extends QAPairRecord {
  registry: QARegistryRecord;
}

export interface QAResult {
  question: string;
  answer: string;
  score: number;
}

export interface CreatePairInput {
  question: string;
  answer: string;
  registryTitle?: string;
  registryDescription?: string;
}

export async function getAllPairs(): Promise<QAPairWithRegistry[]> {
  const pairs = await clientEngine.getAllQAPairs();
  return pairs.map((p) => ({
    ...p,
    registry: {
      id: p.registryId,
      title: p.registryTitle,
      description: null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    },
  }));
}

export async function getRegistries(): Promise<QARegistryRecord[]> {
  const pairs = await clientEngine.getAllQAPairs();
  const titles = Array.from(new Set(pairs.map((p) => p.registryTitle)));
  return titles.map((title) => ({
    id: 0,
    title,
    description: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

export async function getPairById(id: number): Promise<QAPairWithRegistry | null> {
  const pair = await clientEngine.getQAPairById(id);
  if (!pair) return null;
  return {
    ...pair,
    registry: {
      id: pair.registryId,
      title: pair.registryTitle,
      description: null,
      createdAt: pair.createdAt,
      updatedAt: pair.updatedAt,
    },
  };
}

export async function findPairByQuestion(question: string): Promise<QAPairWithRegistry | null> {
  const pairs = await clientEngine.getAllQAPairs();
  const pair = pairs.find((p) => p.question === question) ?? null;
  if (!pair) return null;
  return {
    ...pair,
    registry: {
      id: pair.registryId,
      title: pair.registryTitle,
      description: null,
      createdAt: pair.createdAt,
      updatedAt: pair.updatedAt,
    },
  };
}

export async function createPair(input: CreatePairInput): Promise<QAPairWithRegistry> {
  const pair = await clientEngine.createQAPair({
    question: input.question,
    answer: input.answer,
    registryTitle: input.registryTitle,
  });
  return {
    ...pair,
    registry: {
      id: pair.registryId,
      title: pair.registryTitle,
      description: input.registryDescription ?? null,
      createdAt: pair.createdAt,
      updatedAt: pair.updatedAt,
    },
  };
}

export async function updatePair(
  id: number,
  updates: { question?: string; answer?: string; registryId?: number }
): Promise<QAPairWithRegistry | null> {
  const pair = await clientEngine.updateQAPair(id, updates);
  if (!pair) return null;
  return {
    ...pair,
    registry: {
      id: pair.registryId,
      title: pair.registryTitle,
      description: null,
      createdAt: pair.createdAt,
      updatedAt: pair.updatedAt,
    },
  };
}

export async function deletePair(id: number): Promise<boolean> {
  return clientEngine.deleteQAPair(id);
}

export async function searchPairs(query: string, limit = 10): Promise<QAResult[]> {
  return clientEngine.searchPairs(query, limit);
}

export interface ItemSearchResult {
  filename: string;
  path: string;
  score: number;
  pairs: { question: string; answer: string }[];
}

export async function searchItemsByFilename(query: string, limit = 5): Promise<ItemSearchResult[]> {
  const allDocs = await clientEngine.getAllVectorDocuments();
  const lowerQuery = query.toLowerCase();
  const results: ItemSearchResult[] = [];

  for (const doc of allDocs) {
    const filenameScore = computeWordScore(lowerQuery, doc.name.toLowerCase());
    const contentScore = computeWordScore(lowerQuery, (doc.metadata.title as string || '').toLowerCase());
    const score = Math.max(filenameScore, contentScore * 0.9);

    if (score >= 0.3) {
      const pairs = doc.chunks.map((chunk) => ({
        question: chunk.content.substring(0, 100),
        answer: chunk.content,
      }));
      results.push({
        filename: doc.name,
        path: doc.relativePath,
        score,
        pairs: pairs.slice(0, limit),
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function getItemContent(filename: string): Promise<string | null> {
  const docs = await clientEngine.getAllVectorDocuments();
  const doc = docs.find((d) => d.name === filename);
  if (!doc) return null;
  return doc.chunks.map((c) => c.content).join('\n\n');
}

export async function exportPairAsJson(pair: { question: string; answer: string }, title?: string): Promise<string> {
  const documents = await clientEngine.getAllVectorDocuments();
  const existingNames = new Set(documents.map((d) => d.name));
  let baseName = title || pair.question.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().substring(0, 60) || 'export';
  baseName = baseName.replace(/\.json$/i, '');

  let filename = `${baseName}.json`;
  let counter = 1;
  while (existingNames.has(filename)) {
    filename = `${baseName}_${counter}.json`;
    counter++;
  }

  await clientEngine.addVectorDocument({
    id: filename,
    name: filename,
    originalPath: filename,
    relativePath: filename,
    chunks: [
      {
        documentId: filename,
        documentName: filename,
        chunkIndex: 0,
        content: `Q: ${pair.question}\nR: ${pair.answer}`,
        embedding: [],
      },
    ],
    metadata: { type: 'qa-export', exportedAt: new Date().toISOString() },
  });

  return filename;
}

export async function exportPairsAsJson(
  pairs: { question: string; answer: string }[],
  filename: string,
  title?: string
): Promise<string> {
  const baseName = filename.replace(/\.json$/i, '').trim() || `export_qr_${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const finalName = `${baseName}.json`;

  const chunks = pairs.map((p, i) => ({
    documentId: finalName,
    documentName: finalName,
    chunkIndex: i,
    content: `Q: ${p.question}\nR: ${p.answer}`,
    embedding: [],
  }));

  await clientEngine.addVectorDocument({
    id: finalName,
    name: finalName,
    originalPath: finalName,
    relativePath: finalName,
    chunks,
    metadata: { type: 'qa-export-batch', title: title || baseName, exportedAt: new Date().toISOString() },
  });

  return finalName;
}

export async function importRegistryFiles(): Promise<{ imported: number; skipped: number }> {
  const docs = await clientEngine.getAllVectorDocuments();
  const qaDocs = docs.filter((d) => d.metadata.type === 'qa-export' || d.metadata.type === 'qa-export-batch');
  
  let imported = 0;
  let skipped = 0;

  for (const doc of qaDocs) {
    for (const chunk of doc.chunks) {
      const content = chunk.content;
      const qMatch = content.match(/^Q:\s*(.+)\nR:\s*(.+)$/s);
      if (qMatch) {
        await createPair({
          question: qMatch[1].trim(),
          answer: qMatch[2].trim(),
          registryTitle: doc.metadata.title as string || doc.name,
        });
        imported++;
      } else {
        skipped++;
      }
    }
  }

  return { imported, skipped };
}

function computeWordScore(query: string, text: string): number {
  const queryTerms = query.toLowerCase().split(/[\s,.;:!?()[\]{}]+/).filter(Boolean);
  const textLower = text.toLowerCase();
  let matches = 0;
  for (const term of queryTerms) {
    if (textLower.includes(term)) matches++;
  }
  return queryTerms.length > 0 ? matches / queryTerms.length : 0;
}
