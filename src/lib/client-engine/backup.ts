interface QAPairRowWithRegistry {
  id: number;
  question: string;
  answer: string;
  registry_id: number;
  registry_title: string;
  created_at: string;
  updated_at: string;
}

interface ChatSessionRow {
  id: string;
  title: string | null;
  messages: string;
  created_at: string;
  updated_at: string;
}

import { getDb, query, exec, run } from './sqlite';
import { getAllDocuments, clearVectorStore, addDocument } from './vector-store';
import { jsonGetAll, jsonClear, jsonSet } from './json-store';

export interface BackupData {
  version: number;
  exportedAt: string;
  sqlite: {
    qaPairs: Array<{
      id: number;
      question: string;
      answer: string;
      registryId: number;
      registryTitle: string;
      createdAt: string;
      updatedAt: string;
    }>;
    chatSessions: Array<{
      id: string;
      title: string | null;
      messages: Array<{ role: string; content: string }>;
      createdAt: string;
      updatedAt: string;
    }>;
  };
  vectorStore: Array<{
    id: string;
    name: string;
    originalPath: string;
    relativePath: string;
    chunks: Array<{
      documentId: string;
      documentName: string;
      chunkIndex: number;
      content: string;
      embedding: number[];
      metadata?: Record<string, unknown>;
    }>;
    metadata: Record<string, unknown>;
  }>;
  jsonStore: Record<string, unknown>;
}

export async function exportBackup(): Promise<Blob> {
  const db = getDb();

  let qaPairs: BackupData['sqlite']['qaPairs'] = [];
  let chatSessions: BackupData['sqlite']['chatSessions'] = [];

  if (db) {
    try {
      const qaRows = await query<QAPairRowWithRegistry>(`
        SELECT qa_pairs.*, qa_registries.title as registry_title
        FROM qa_pairs
        LEFT JOIN qa_registries ON qa_pairs.registry_id = qa_registries.id
        ORDER BY qa_pairs.created_at DESC
      `);
      qaPairs = qaRows.map((row) => ({
        id: row.id,
        question: row.question,
        answer: row.answer,
        registryId: row.registry_id,
        registryTitle: row.registry_title || 'Général',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch {
      // ignore
    }

    try {
      const sessionRows = await query<ChatSessionRow>('SELECT * FROM chat_sessions ORDER BY updated_at DESC');
      chatSessions = sessionRows.map((row) => ({
        id: row.id,
        title: row.title,
        messages: JSON.parse(row.messages || '[]'),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch {
      // ignore
    }
  }

  let vectorStore: BackupData['vectorStore'] = [];
  try {
    const docs = await getAllDocuments();
    vectorStore = docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      originalPath: doc.originalPath,
      relativePath: doc.relativePath,
      chunks: doc.chunks.map((chunk) => ({
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embedding: chunk.embedding,
        metadata: chunk.metadata,
      })),
      metadata: doc.metadata,
    }));
  } catch {
    // ignore
  }

  let jsonStore: BackupData['jsonStore'] = {};
  try {
    jsonStore = await jsonGetAll();
  } catch {
    // ignore
  }

  const backup: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    sqlite: {
      qaPairs,
      chatSessions,
    },
    vectorStore,
    jsonStore,
  };

  return new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
}

export async function importBackup(blob: Blob): Promise<{ imported: { pairs: number; sessions: number; documents: number; jsonKeys: number } }> {
  const text = await blob.text();
  const backup = JSON.parse(text) as BackupData;

  if (!backup.version || backup.version !== 1) {
    throw new Error('Format de sauvegarde non supporté');
  }

  const result = { imported: { pairs: 0, sessions: 0, documents: 0, jsonKeys: 0 } };

  const db = getDb();
  if (db) {
    try {
      await exec('DELETE FROM qa_pairs');
      await exec('DELETE FROM qa_registries');
      await exec('DELETE FROM chat_sessions');
    } catch {
      // ignore
    }
  }

  for (const pair of backup.sqlite.qaPairs) {
    try {
      if (db) {
        await run(
          'INSERT INTO qa_registries (id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING',
          [pair.registryId, pair.registryTitle, null, pair.createdAt, pair.updatedAt]
        );
        await run(
          'INSERT INTO qa_pairs (id, question, answer, registry_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING',
          [pair.id, pair.question, pair.answer, pair.registryId, pair.createdAt, pair.updatedAt]
        );
      }
      result.imported.pairs++;
    } catch {
      // ignore
    }
  }

  for (const session of backup.sqlite.chatSessions) {
    try {
      if (db) {
        await run(
          'INSERT INTO chat_sessions (id, title, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING',
          [session.id, session.title, JSON.stringify(session.messages), session.createdAt, session.updatedAt]
        );
      }
      result.imported.sessions++;
    } catch {
      // ignore
    }
  }

  try {
    await clearVectorStore();
    for (const doc of backup.vectorStore) {
      await addDocument({
        id: doc.id,
        name: doc.name,
        originalPath: doc.originalPath,
        relativePath: doc.relativePath,
        chunks: doc.chunks.map((chunk) => ({
          documentId: chunk.documentId,
          documentName: chunk.documentName,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          embedding: chunk.embedding,
          metadata: chunk.metadata || {},
        })),
        metadata: doc.metadata,
      });
      result.imported.documents++;
    }
  } catch {
    // ignore
  }

  try {
    await jsonClear();
    for (const [key, value] of Object.entries(backup.jsonStore)) {
      await jsonSet(key, value);
      result.imported.jsonKeys++;
    }
  } catch {
    // ignore
  }

  return result;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
