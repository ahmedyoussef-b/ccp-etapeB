import { initSqlite, getDb, query, queryOne, run } from './sqlite';
import { initVectorStore, searchByEmbedding, addDocument, getAllDocuments, deleteDocument, getStats, clearVectorStore, simpleTokenEmbedding, type VectorDocument } from './vector-store';
import { initJsonStore, jsonGet, jsonSet, jsonDelete, jsonClear, jsonGetAll } from './json-store';

export { initSqlite, getDb, query, queryOne, run, exec } from './sqlite';
export {
  initVectorStore,
  searchByEmbedding,
  addDocument,
  getAllDocuments,
  deleteDocument,
  getStats,
  clearVectorStore,
  simpleTokenEmbedding,
} from './vector-store';
export { initJsonStore, jsonGet, jsonSet, jsonDelete, jsonClear, jsonGetAll } from './json-store';

export interface ClientEngineStatus {
  sqlite: boolean;
  vectorStore: boolean;
  jsonStore: boolean;
}

export interface QAPair {
  id: number;
  question: string;
  answer: string;
  registryId: number;
  registryTitle: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSession {
  id: string;
  title: string | null;
  messages: Array<{ role: string; content: string }>;
  createdAt: string;
  updatedAt: string;
}

interface QARegistryRow {
  id: number;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface QAPairRow {
  id: number;
  question: string;
  answer: string;
  registry_id: number;
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

export class ClientEngine {
  private static instance: ClientEngine | null = null;
  private initialized = false;

  static getInstance(): ClientEngine {
    if (!ClientEngine.instance) {
      ClientEngine.instance = new ClientEngine();
    }
    return ClientEngine.instance;
  }

  async init(): Promise<ClientEngineStatus> {
    if (this.initialized) {
      return { sqlite: true, vectorStore: true, jsonStore: true };
    }

    const status: ClientEngineStatus = { sqlite: false, vectorStore: false, jsonStore: false };

    try {
      await initSqlite();
      status.sqlite = true;
    } catch (error) {
      console.error('[ClientEngine] SQLite init failed:', error);
    }

    try {
      await initVectorStore();
      status.vectorStore = true;
    } catch (error) {
      console.error('[ClientEngine] VectorStore init failed:', error);
    }

    try {
      await initJsonStore();
      status.jsonStore = true;
    } catch (error) {
      console.error('[ClientEngine] JsonStore init failed:', error);
    }

    this.initialized = true;
    console.log('[ClientEngine] Initialisation terminée:', status);
    return status;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async getAllQAPairs(): Promise<QAPair[]> {
    const db = getDb();
    if (!db) return [];
    const results = await query<QAPairRow & { registry_title: string }>(`
      SELECT qa_pairs.*, qa_registries.title as registry_title
      FROM qa_pairs
      LEFT JOIN qa_registries ON qa_pairs.registry_id = qa_registries.id
      ORDER BY qa_pairs.created_at DESC
    `);
    return results.map((row) => ({
      id: row.id,
      question: row.question,
      answer: row.answer,
      registryId: row.registry_id,
      registryTitle: row.registry_title || 'Général',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getQAPairById(id: number): Promise<QAPair | null> {
    const db = getDb();
    if (!db) return null;
    const results = await query<QAPairRow & { registry_title: string }>(`
      SELECT qa_pairs.*, qa_registries.title as registry_title
      FROM qa_pairs
      LEFT JOIN qa_registries ON qa_pairs.registry_id = qa_registries.id
      WHERE qa_pairs.id = ?
    `, [id]);
    if (results.length === 0) return null;
    const row = results[0];
    return {
      id: row.id,
      question: row.question,
      answer: row.answer,
      registryId: row.registry_id,
      registryTitle: row.registry_title || 'Général',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async createQAPair(pair: { question: string; answer: string; registryTitle?: string }): Promise<QAPair> {
    const db = getDb();
    if (!db) throw new Error('SQLite non initialisé');

    const title = pair.registryTitle || pair.question.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().substring(0, 60) || 'Général';

    const registryResult = await queryOne<QARegistryRow>('SELECT id FROM qa_registries WHERE title = ?', [title]);
    let registryId = registryResult?.id;

    if (!registryId) {
      const result = await run('INSERT INTO qa_registries (title) VALUES (?)', [title]);
      registryId = result.lastInsertRowid;
    }

    const insertResult = await run(
      'INSERT INTO qa_pairs (question, answer, registry_id) VALUES (?, ?, ?)',
      [pair.question.trim(), pair.answer.trim(), registryId]
    );

    const id = insertResult.lastInsertRowid;
    const created = await this.getQAPairById(id);
    return created!;
  }

  async updateQAPair(id: number, updates: { question?: string; answer?: string }): Promise<QAPair | null> {
    const db = getDb();
    if (!db) return null;

    const existing = await this.getQAPairById(id);
    if (!existing) return null;

    const question = updates.question ?? existing.question;
    const answer = updates.answer ?? existing.answer;

    await run('UPDATE qa_pairs SET question = ?, answer = ?, updated_at = datetime("now") WHERE id = ?', [
      question,
      answer,
      id,
    ]);

    return this.getQAPairById(id);
  }

  async deleteQAPair(id: number): Promise<boolean> {
    const db = getDb();
    if (!db) return false;
    const result = await run('DELETE FROM qa_pairs WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async searchPairs(query: string, limit = 10): Promise<Array<{ question: string; answer: string; score: number }>> {
    const pairs = await this.getAllQAPairs();
    if (!query.trim() || pairs.length === 0) return [];

    const results = pairs.map((p) => ({
      question: p.question,
      answer: p.answer,
      score: computeWordScore(query, p.question),
    }));

    return rankResults(query, results).slice(0, limit);
  }

  async createChatSession(title?: string): Promise<ChatSession> {
    const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const session: ChatSession = {
      id,
      title: title || null,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    const db = getDb();
    if (db) {
      await run(
        'INSERT INTO chat_sessions (id, title, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [id, title || null, JSON.stringify([]), now, now]
      );
    }

    await jsonSet(`chat_session_${id}`, session);
    return session;
  }

  async getChatSession(id: string): Promise<ChatSession | null> {
    const db = getDb();
    if (db) {
      const results = await query<ChatSessionRow>('SELECT * FROM chat_sessions WHERE id = ?', [id]);
      if (results.length > 0) {
        const row = results[0];
        return {
          id: row.id,
          title: row.title,
          messages: JSON.parse(row.messages || '[]'),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      }
    }

    const stored = await jsonGet<ChatSession>(`chat_session_${id}`);
    return stored ?? null;
  }

  async updateChatSession(id: string, updates: { messages?: Array<{ role: string; content: string }>; title?: string }): Promise<ChatSession | null> {
    const db = getDb();
    const session = await this.getChatSession(id);
    if (!session) return null;

    const updated = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (db) {
      await run(
        'UPDATE chat_sessions SET title = ?, messages = ?, updated_at = datetime("now") WHERE id = ?',
        [updated.title, JSON.stringify(updated.messages), id]
      );
    }

    await jsonSet(`chat_session_${id}`, updated);
    return updated;
  }

  async deleteChatSession(id: string): Promise<boolean> {
    const db = getDb();
    if (db) {
      const result = await run('DELETE FROM chat_sessions WHERE id = ?', [id]);
      if (result.changes > 0) {
        await jsonDelete(`chat_session_${id}`);
        return true;
      }
    }
    await jsonDelete(`chat_session_${id}`);
    return true;
  }

  async getRecentChatSessions(limit = 20): Promise<ChatSession[]> {
    const db = getDb();
    if (db) {
      const results = await query<ChatSessionRow>('SELECT * FROM chat_sessions ORDER BY updated_at DESC LIMIT ?', [limit]);
      return results.map((row) => ({
        id: row.id,
        title: row.title,
        messages: JSON.parse(row.messages || '[]'),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    }

    const all = await jsonGetAll<ChatSession>();
    return Object.values(all)
      .filter((s) => s.id.startsWith('session_'))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  async searchChatSessions(query: string, limit = 20): Promise<ChatSession[]> {
    const sessions = await this.getRecentChatSessions(limit * 2);
    const lowerQuery = query.toLowerCase();
    return sessions
      .filter((s) => {
        if (s.title?.toLowerCase().includes(lowerQuery)) return true;
        return s.messages.some((m) => m.content.toLowerCase().includes(lowerQuery));
      })
      .slice(0, limit);
  }

  async addVectorDocument(doc: Parameters<typeof addDocument>[0]): Promise<void> {
    await addDocument(doc);
  }

  async searchVector(query: string, topK = 5): Promise<Array<{ content: string; score: number; source: string; metadata?: Record<string, unknown> }>> {
    const queryVec = simpleTokenEmbedding(query);
    const results = await searchByEmbedding(queryVec, topK);
    return results.map((r) => ({
      content: r.content,
      score: r.score,
      source: `vector://${r.documentName}`,
      metadata: r.metadata,
    }));
  }

  async getAllVectorDocuments(): Promise<VectorDocument[]> {
    return getAllDocuments();
  }

  async deleteVectorDocument(id: string): Promise<void> {
    await deleteDocument(id);
  }

  async clearAllData(): Promise<void> {
    const db = getDb();
    if (db) {
      db.exec('DELETE FROM qa_pairs');
      db.exec('DELETE FROM qa_registries');
      db.exec('DELETE FROM chat_sessions');
      db.exec('DELETE FROM local_tree');
      db.exec('DELETE FROM vector_documents');
    }
    await clearVectorStore();
    await jsonClear();
  }

  async getStats(): Promise<{ pairs: number; sessions: number; documents: number; chunks: number }> {
    const db = getDb();
    let pairs = 0;
    let sessions = 0;
    if (db) {
      const pairsResult = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM qa_pairs');
      pairs = pairsResult?.count ?? 0;
      const sessionsResult = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM chat_sessions');
      sessions = sessionsResult?.count ?? 0;
    }
    const vectorStats = await getStats();
    return { pairs, sessions, documents: vectorStats.documentCount, chunks: vectorStats.chunkCount };
  }

  async exportAll(): Promise<{
    qaPairs: Array<{ id: number; question: string; answer: string; registryId: number; registryTitle: string; createdAt: string; updatedAt: string }>;
    chatSessions: Array<{ id: string; title: string | null; messages: Array<{ role: string; content: string }>; createdAt: string; updatedAt: string }>;
    localTree: Array<{ id: number; remoteId: string; name: string; type: string; parentId: number | null; order: number; path: string; size: number | undefined; content: string | null; createdAt: string; updatedAt: string }>;
    vectorDocuments: Array<{ id: string; name: string; originalPath: string; relativePath: string; chunks: Array<{ documentId: string; documentName: string; chunkIndex: number; content: string; embedding: number[]; metadata?: Record<string, unknown> }>; metadata: Record<string, unknown> }>;
    jsonStore: Record<string, unknown>;
  }> {
    const db = getDb();
    let qaPairs: Array<{ id: number; question: string; answer: string; registryId: number; registryTitle: string; createdAt: string; updatedAt: string }> = [];
    let chatSessions: Array<{ id: string; title: string | null; messages: Array<{ role: string; content: string }>; createdAt: string; updatedAt: string }> = [];
    let localTree: Array<{ id: number; remoteId: string; name: string; type: string; parentId: number | null; order: number; path: string; size: number | undefined; content: string | null; createdAt: string; updatedAt: string }> = [];

    if (db) {
      try {
        const qaRows = await query<QAPairRow & { registry_title: string }>(`
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

      try {
        const treeRows = await query<{ id: number; remote_id: string; name: string; type: string; parent_id: number | null; node_order: number; path: string | null; size: number | null; content: string | null; created_at: string; updated_at: string }>(`
          SELECT * FROM local_tree ORDER BY created_at DESC
        `);
        localTree = treeRows.map((row) => ({
          id: row.id,
          remoteId: row.remote_id,
          name: row.name,
          type: row.type,
          parentId: row.parent_id,
          order: row.node_order ?? 0,
          path: row.path ?? '',
          size: row.size ?? undefined,
          content: row.content,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
      } catch {
        // ignore
      }
    }

    let vectorDocuments: Array<{ id: string; name: string; originalPath: string; relativePath: string; chunks: Array<{ documentId: string; documentName: string; chunkIndex: number; content: string; embedding: number[]; metadata?: Record<string, unknown> }>; metadata: Record<string, unknown> }> = [];
    try {
      const docs = await getAllDocuments();
      vectorDocuments = docs.map((doc) => ({
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

    let jsonStore: Record<string, unknown> = {};
    try {
      jsonStore = await jsonGetAll();
    } catch {
      // ignore
    }

    return { qaPairs, chatSessions, localTree, vectorDocuments, jsonStore };
  }

  async exportPairAsJson(pair: { question: string; answer: string }, title?: string): Promise<string> {
    const documents = await getAllDocuments();
    const existingNames = new Set(documents.map((d) => d.name));
    let baseName = title || pair.question.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().substring(0, 60) || 'export';
    baseName = baseName.replace(/\.json$/i, '');

    let filename = `${baseName}.json`;
    let counter = 1;
    while (existingNames.has(filename)) {
      filename = `${baseName}_${counter}.json`;
      counter++;
    }

    await addDocument({
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

  async exportPairsAsJson(
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

    await addDocument({
      id: finalName,
      name: finalName,
      originalPath: finalName,
      relativePath: finalName,
      chunks,
      metadata: { type: 'qa-export-batch', title: title || baseName, exportedAt: new Date().toISOString() },
    });

    return finalName;
  }
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

function rankResults(query: string, results: Array<{ question: string; answer: string; score: number }>): typeof results {
  const queryTerms = query.toLowerCase().split(/[\s,.;:!?()[\]{}]+/).filter(Boolean);
  return results
    .map((r) => {
      const text = `${r.question} ${r.answer}`.toLowerCase();
      let exactMatches = 0;
      for (const term of queryTerms) {
        if (text.includes(term)) exactMatches++;
      }
      const boost = exactMatches > 0 ? 0.2 : 0;
      return { ...r, score: Math.min(r.score + boost, 1) };
    })
    .sort((a, b) => b.score - a.score);
}

export const clientEngine = ClientEngine.getInstance();
