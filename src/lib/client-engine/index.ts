import { initSqlite, getDb, query, queryOne, run } from './sqlite';
export { initSqlite, initSQLite, getDb, query, queryOne, run, exec, createProcedureTables, createExecutionTables, createOtherTables, sqliteSyncHelpers, sqliteCrud } from './sqlite';
import { initVectorStore, searchByEmbedding, addDocument, getAllDocuments, deleteDocument, getDocument, getStats, clearVectorStore, simpleTokenEmbedding, addVectorTreeNode, getAllVectorTreeNodes, deleteVectorTreeNode, clearVectorTree, type VectorDocument, type VectorTreeNode } from './vector-store';
import { initJsonStore, jsonGet, jsonSet, jsonDelete, jsonClear, jsonGetAll } from './json-store';

export {
  initVectorStore,
  searchByEmbedding,
  addDocument,
  getAllDocuments,
  deleteDocument,
  getDocument,
  getStats,
  clearVectorStore,
  simpleTokenEmbedding,
  addVectorTreeNode,
  getAllVectorTreeNodes,
  deleteVectorTreeNode,
  clearVectorTree,
  type VectorDocument,
  type VectorTreeNode,
} from './vector-store';
export { initJsonStore, jsonGet, jsonSet, jsonDelete, jsonClear, jsonGetAll } from './json-store';

export interface SensorConfig {
  id: string;
  name: string;
  type: string;
  value: number;
  unit: string;
  threshold: number;
  updatedAt: string;
}

export interface ActuatorState {
  id: string;
  name: string;
  type: string;
  isOn: boolean;
  position: number | null;
  updatedAt: string;
}

export interface IotHistoryEntry {
  id: number;
  entityType: string;
  entityId: string;
  field: string;
  oldValue: string | null;
  newValue: string;
  alert: boolean;
  resolved: boolean;
  createdAt: string;
}

export interface Device {
  id: string;
  name: string;
  type: "sensor" | "actuator" | "camera";
  subtype: string | null;
  ipAddress: string | null;
  port: number | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

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

export interface ImageMetadata {
  id: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
  kind: 'image' | 'video';
  mimeType: string;
  size: number;
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
  private initStatus: ClientEngineStatus = { sqlite: false, vectorStore: false, jsonStore: false };

  static getInstance(): ClientEngine {
    if (!ClientEngine.instance) {
      ClientEngine.instance = new ClientEngine();
    }
    return ClientEngine.instance;
  }

  async init(): Promise<ClientEngineStatus> {
    if (this.initialized) {
      return { ...this.initStatus };
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

    this.initialized = status.sqlite && status.vectorStore && status.jsonStore;
    this.initStatus = status;
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

    await run('UPDATE qa_pairs SET question = ?, answer = ?, updated_at = datetime(\'now\') WHERE id = ?', [
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
        'UPDATE chat_sessions SET title = ?, messages = ?, updated_at = datetime(\'now\') WHERE id = ?',
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

  async getAllVectorTreeNodes(): Promise<VectorTreeNode[]> {
    return getAllVectorTreeNodes();
  }

  async addVectorTreeNode(node: Omit<VectorTreeNode, 'createdAt'>): Promise<void> {
    await addVectorTreeNode(node);
  }

  async deleteVectorTreeNode(id: string): Promise<void> {
    await deleteVectorTreeNode(id);
  }

  async clearVectorTree(): Promise<void> {
    await clearVectorTree();
  }

  /**
   * Vectorize a media item and its metadata for RAG AI multimodal / semantic search.
   * Stores rich metadata with type: 'image_metadata' for ImageRetriever & AI queries.
   */
  async vectorizeMediaItem(media: {
    id: string;
    title: string;
    category?: string;
    description?: string;
    tags?: string[];
    kind?: "image" | "video";
    mimeType?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const docId = `media-${media.id}`;
    const tagsStr = Array.isArray(media.tags) ? media.tags.join(" ") : "";
    const cat = media.category || "sans-categorie";
    const kind = media.kind || "image";
    const desc = media.description || "";
    const title = media.title || media.id;

    const content = `[Média ${kind}: ${title}] Catégorie: ${cat} | Description: ${desc} | Tags: ${tagsStr} | Type: ${media.mimeType || kind}`;

    const chunks = [{
      documentId: docId,
      documentName: title,
      chunkIndex: 0,
      content,
      embedding: simpleTokenEmbedding(content),
      metadata: {
        type: "image_metadata",
        imageId: media.id,
        title,
        category: cat,
        kind,
        description: desc,
        tags: media.tags || [],
        mimeType: media.mimeType,
        ...media.metadata,
      },
    }];

    await this.addVectorDocument({
      id: docId,
      name: title,
      originalPath: `${cat}/${title}`,
      relativePath: `${cat}/${title}`,
      chunks,
      metadata: {
        source: "media",
        type: "image_metadata",
        imageId: media.id,
        kind,
        category: cat,
        title,
      },
    });

    const pathParts = `${cat}/${title}`.split("/").filter(Boolean);
    let currentPath = "";
    let parentId: string | null = null;

    for (let i = 0; i < pathParts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${pathParts[i]}` : pathParts[i];
      const treeNodeId = `vf-${currentPath}`;
      await this.addVectorTreeNode({
        id: treeNodeId,
        name: pathParts[i],
        type: "folder",
        parentId,
        order: i,
        relativePath: currentPath,
        content: null,
        docId: null,
      });
      parentId = treeNodeId;
    }

    await this.addVectorTreeNode({
      id: `vf-${cat}/${title}`,
      name: title,
      type: "file",
      parentId,
      order: 0,
      relativePath: `${cat}/${title}`,
      content,
      docId,
    });
  }

  async resetLocalTreeOnly(): Promise<void> {
    const db = getDb();
    if (db) {
      db.exec('DELETE FROM local_tree');
    }
  }

  async factoryReset(): Promise<void> {
    const db = getDb();
    if (db) {
      db.exec('DELETE FROM qa_pairs');
      db.exec('DELETE FROM qa_registries');
      db.exec('DELETE FROM chat_sessions');
      db.exec('DELETE FROM local_tree');
      db.exec('DELETE FROM vector_documents');
      db.exec('DELETE FROM sensor_configs');
      db.exec('DELETE FROM actuator_states');
      db.exec('DELETE FROM iot_history');
    }
    await clearVectorStore();
    await jsonClear();
  }

  async clearAllVectorDocuments(): Promise<void> {
    await clearVectorStore();
    await clearVectorTree();
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
    sensorConfigs: Array<{ id: string; name: string; type: string; value: number; unit: string; threshold: number; updatedAt: string }>;
    actuatorStates: Array<{ id: string; name: string; type: string; isOn: boolean; position: number | null; updatedAt: string }>;
    iotHistory: Array<{ id: number; entityType: string; entityId: string; field: string; oldValue: string | null; newValue: string; alert: boolean; createdAt: string }>;
    jsonStore: Record<string, unknown>;
  }> {
    const db = getDb();
    let qaPairs: Array<{ id: number; question: string; answer: string; registryId: number; registryTitle: string; createdAt: string; updatedAt: string }> = [];
    let chatSessions: Array<{ id: string; title: string | null; messages: Array<{ role: string; content: string }>; createdAt: string; updatedAt: string }> = [];
    let localTree: Array<{ id: number; remoteId: string; name: string; type: string; parentId: number | null; order: number; path: string; size: number | undefined; content: string | null; createdAt: string; updatedAt: string }> = [];
    let sensorConfigs: Array<{ id: string; name: string; type: string; value: number; unit: string; threshold: number; updatedAt: string }> = [];
    let actuatorStates: Array<{ id: string; name: string; type: string; isOn: boolean; position: number | null; updatedAt: string }> = [];

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

      try {
        const sensorRows = await query<{ id: string; name: string; type: string; value: number; unit: string; threshold: number; updated_at: string }>(`SELECT * FROM sensor_configs`);
        sensorConfigs = sensorRows.map((row) => ({
          id: row.id,
          name: row.name,
          type: row.type,
          value: row.value,
          unit: row.unit,
          threshold: row.threshold,
          updatedAt: row.updated_at,
        }));
      } catch {
        // ignore
      }

      try {
        const actuatorRows = await query<{ id: string; name: string; type: string; is_on: number; position: number | null; updated_at: string }>(`SELECT * FROM actuator_states`);
        actuatorStates = actuatorRows.map((row) => ({
          id: row.id,
          name: row.name,
          type: row.type,
          isOn: Boolean(row.is_on),
          position: row.position,
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
          documentName: chunk.documentName ?? '',
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

    let iotHistory: Array<{ id: number; entityType: string; entityId: string; field: string; oldValue: string | null; newValue: string; alert: boolean; createdAt: string }> = [];
    try {
      const historyRows = await query<{ id: number; entity_type: string; entity_id: string; field: string; old_value: string | null; new_value: string; alert: number; created_at: string }>(`SELECT * FROM iot_history ORDER BY created_at DESC`);
      iotHistory = historyRows.map((row) => ({
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        field: row.field,
        oldValue: row.old_value,
        newValue: row.new_value,
        alert: Boolean(row.alert),
        createdAt: row.created_at,
      }));
    } catch {
      // ignore
    }

    return { qaPairs, chatSessions, localTree, vectorDocuments, sensorConfigs, actuatorStates, iotHistory, jsonStore };
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

  async syncImageMetadata(images: ImageMetadata[]): Promise<void> {
    const DOC_ID = 'image-metadata';
    const DOC_NAME = 'banque-images-metadata';

    try {
      await deleteDocument(DOC_ID);
    } catch {
      // ignore if not exists
    }

    if (images.length === 0) return;

    const chunks = images.map((img, index) => {
      const text = [
        img.title,
        img.description,
        img.category,
        ...img.tags,
        img.kind,
        img.mimeType,
      ]
        .filter(Boolean)
        .join(' ');

      return {
        documentId: DOC_ID,
        documentName: DOC_NAME,
        chunkIndex: index,
        content: text,
        embedding: simpleTokenEmbedding(text),
        metadata: {
          type: 'image_metadata',
          imageId: img.id,
          title: img.title,
          category: img.category,
          tags: img.tags,
          kind: img.kind,
          mimeType: img.mimeType,
          size: img.size,
          createdAt: img.createdAt,
          updatedAt: img.updatedAt,
        },
      };
    });

    await addDocument({
      id: DOC_ID,
      name: DOC_NAME,
      originalPath: 'banque-d-images',
      relativePath: 'banque-d-images',
      chunks,
      metadata: { type: 'image_metadata_collection', count: images.length },
    });
  }

  async getVectorizedImageIds(): Promise<Set<string>> {
    const DOC_ID = 'image-metadata';
    const ids = new Set<string>();

    try {
      const doc = await getDocument(DOC_ID);
      if (!doc || !doc.chunks || doc.chunks.length === 0) {
        return ids;
      }

      for (const chunk of doc.chunks) {
        const meta = chunk.metadata as { imageId?: string } | undefined;
        if (meta?.imageId) {
          ids.add(meta.imageId);
        }
      }
    } catch {
      // ignore
    }

    return ids;
  }

  async getAllSensorConfigs(): Promise<SensorConfig[]> {
    const db = getDb();
    if (!db) return [];
    const results = await query<{ id: string; name: string; type: string; value: number; unit: string; threshold: number; updated_at: string }>(`SELECT * FROM sensor_configs`);
    return results.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      value: row.value,
      unit: row.unit,
      threshold: row.threshold,
      updatedAt: row.updated_at,
    }));
  }

  async getSensorConfig(id: string): Promise<SensorConfig | null> {
    const db = getDb();
    if (!db) return null;
    const results = await query<{ id: string; name: string; type: string; value: number; unit: string; threshold: number; updated_at: string }>(`SELECT * FROM sensor_configs WHERE id = ?`, [id]);
    if (results.length === 0) return null;
    const row = results[0];
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      value: row.value,
      unit: row.unit,
      threshold: row.threshold,
      updatedAt: row.updated_at,
    };
  }

  async upsertSensorConfig(config: { id: string; name: string; type: string; value: number; unit: string; threshold: number }): Promise<SensorConfig> {
    const db = getDb();
    if (!db) throw new Error('SQLite non initialisé');
    const existing = await this.getSensorConfig(config.id);
    const oldValue = existing ? String(existing.value) : null;
    await run(
      `INSERT INTO sensor_configs (id, name, type, value, unit, threshold, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET name = excluded.name, type = excluded.type, value = excluded.value, unit = excluded.unit, threshold = excluded.threshold, updated_at = excluded.updated_at`,
      [config.id, config.name, config.type, config.value, config.unit, config.threshold]
    );
    const row = await this.getSensorConfig(config.id);
    const alert = config.value > config.threshold;
    await this.addIotHistoryEntry({
      entityType: 'sensor',
      entityId: config.id,
      field: 'value',
      oldValue,
      newValue: String(config.value),
      alert,
    });
    return row!;
  }

  async getAllActuatorStates(): Promise<ActuatorState[]> {
    const db = getDb();
    if (!db) return [];
    const results = await query<{ id: string; name: string; type: string; is_on: number; position: number | null; updated_at: string }>(`SELECT * FROM actuator_states`);
    return results.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      isOn: Boolean(row.is_on),
      position: row.position,
      updatedAt: row.updated_at,
    }));
  }

  async getActuatorState(id: string): Promise<ActuatorState | null> {
    const db = getDb();
    if (!db) return null;
    const results = await query<{ id: string; name: string; type: string; is_on: number; position: number | null; updated_at: string }>(`SELECT * FROM actuator_states WHERE id = ?`, [id]);
    if (results.length === 0) return null;
    const row = results[0];
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      isOn: Boolean(row.is_on),
      position: row.position,
      updatedAt: row.updated_at,
    };
  }

  async upsertActuatorState(state: { id: string; name: string; type: string; isOn: boolean; position?: number | null }): Promise<ActuatorState> {
    const db = getDb();
    if (!db) throw new Error('SQLite non initialisé');
    const existing = await this.getActuatorState(state.id);
    const oldValue = existing ? String(existing.isOn) : null;
    await run(
      `INSERT INTO actuator_states (id, name, type, is_on, position, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET name = excluded.name, type = excluded.type, is_on = excluded.is_on, position = excluded.position, updated_at = excluded.updated_at`,
      [state.id, state.name, state.type, state.isOn ? 1 : 0, state.position ?? null]
    );
    const row = await this.getActuatorState(state.id);
    await this.addIotHistoryEntry({
      entityType: 'actuator',
      entityId: state.id,
      field: 'isOn',
      oldValue,
      newValue: String(state.isOn),
      alert: false,
    });
    return row!;
  }

  async syncIotMetadata(): Promise<void> {
    const db = getDb();
    if (!db) return;

    const sensorRows = await query<{ id: string; name: string; type: string; value: number; unit: string; threshold: number; updated_at: string }>(`SELECT * FROM sensor_configs`);
    const actuatorRows = await query<{ id: string; name: string; type: string; is_on: number; position: number | null; updated_at: string }>(`SELECT * FROM actuator_states`);

    for (const row of sensorRows) {
      if (row.value > row.threshold) {
        const lastAlert = await queryOne<{ alert: number }>(`SELECT alert FROM iot_history WHERE entity_id = ? AND entity_type = 'sensor' AND field = 'value' ORDER BY created_at DESC LIMIT 1`, [row.id]);
        const wasAlert = lastAlert ? Boolean(lastAlert.alert) : false;
        if (!wasAlert) {
          await this.addIotHistoryEntry({
            entityType: 'sensor',
            entityId: row.id,
            field: 'value',
            oldValue: String(row.value),
            newValue: `${row.value} (seuil: ${row.threshold})`,
            alert: true,
          });
        }
      }
    }

    const chunks: Array<{ documentId: string; documentName: string; chunkIndex: number; content: string; embedding: number[]; metadata?: Record<string, unknown> }> = [];

    for (const row of sensorRows) {
      chunks.push({
        documentId: `sensor-${row.id}`,
        documentName: 'iot-sensor-configs',
        chunkIndex: chunks.length,
        content: `Le capteur ${row.name} (${row.type}) est à ${row.value}${row.unit}. Seuil d'alarme: ${row.threshold}${row.unit}.`,
        embedding: simpleTokenEmbedding(`capteur ${row.name} ${row.type} ${row.value} ${row.unit}`),
        metadata: { type: 'sensor_config', sensorId: row.id, sensorType: row.type, value: row.value, unit: row.unit, threshold: row.threshold, updatedAt: row.updated_at },
      });
    }

    for (const row of actuatorRows) {
      const state = row.is_on ? 'allumé' : 'éteint';
      const pos = row.position !== null ? ` position ${row.position}` : '';
      chunks.push({
        documentId: `actuator-${row.id}`,
        documentName: 'iot-actuator-states',
        chunkIndex: chunks.length,
        content: `L'actionneur ${row.name} (${row.type}) est ${state}.${pos}`,
        embedding: simpleTokenEmbedding(`actionneur ${row.name} ${row.type} ${state}`),
        metadata: { type: 'actuator_state', actuatorId: row.id, actuatorType: row.type, isOn: Boolean(row.is_on), position: row.position, updatedAt: row.updated_at },
      });
    }

    if (chunks.length === 0) return;

    try {
      await deleteDocument('iot-metadata');
    } catch {
      // ignore if not exists
    }

    await addDocument({
      id: 'iot-metadata',
      name: 'iot-metadata',
      originalPath: 'iot-metadata',
      relativePath: 'iot-metadata',
      chunks,
      metadata: { type: 'iot_metadata_collection', sensorCount: sensorRows.length, actuatorCount: actuatorRows.length },
    });
  }

  async addIotHistoryEntry(entry: { entityType: string; entityId: string; field: string; oldValue?: string | null; newValue: string; alert?: boolean; resolved?: boolean }): Promise<void> {
    const db = getDb();
    if (!db) return;
    await run(
      `INSERT INTO iot_history (entity_type, entity_id, field, old_value, new_value, alert, resolved) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [entry.entityType, entry.entityId, entry.field, entry.oldValue ?? null, entry.newValue, entry.alert ? 1 : 0, entry.resolved ? 1 : 0]
    );
  }

  async getIotHistory(limit = 100): Promise<IotHistoryEntry[]> {
    const db = getDb();
    if (!db) return [];
    const results = await query<{ id: number; entity_type: string; entity_id: string; field: string; old_value: string | null; new_value: string; alert: number; resolved: number; created_at: string }>(`SELECT * FROM iot_history ORDER BY created_at DESC LIMIT ?`, [limit]);
    return results.map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      field: row.field,
      oldValue: row.old_value,
      newValue: row.new_value,
      alert: Boolean(row.alert),
      resolved: Boolean(row.resolved),
      createdAt: row.created_at,
    }));
  }

  async getIotHistoryByEntity(entityId: string, limit = 50): Promise<IotHistoryEntry[]> {
    const db = getDb();
    if (!db) return [];
    const results = await query<{ id: number; entity_type: string; entity_id: string; field: string; old_value: string | null; new_value: string; alert: number; resolved: number; created_at: string }>(`SELECT * FROM iot_history WHERE entity_id = ? ORDER BY created_at DESC LIMIT ?`, [entityId, limit]);
    return results.map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      field: row.field,
      oldValue: row.old_value,
      newValue: row.new_value,
      alert: Boolean(row.alert),
      resolved: Boolean(row.resolved),
      createdAt: row.created_at,
    }));
  }

  async getActiveAlarms(limit = 100): Promise<IotHistoryEntry[]> {
    const db = getDb();
    if (!db) return [];
    const results = await query<{ id: number; entity_type: string; entity_id: string; field: string; old_value: string | null; new_value: string; alert: number; resolved: number; created_at: string }>(`SELECT * FROM iot_history WHERE alert = 1 AND resolved = 0 ORDER BY created_at DESC LIMIT ?`, [limit]);
    return results.map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      field: row.field,
      oldValue: row.old_value,
      newValue: row.new_value,
      alert: Boolean(row.alert),
      resolved: Boolean(row.resolved),
      createdAt: row.created_at,
    }));
  }

  async acknowledgeAlarm(id: number): Promise<void> {
    const db = getDb();
    if (!db) return;
    await run(`UPDATE iot_history SET resolved = 1 WHERE id = ?`, [id]);
  }

  async acknowledgeAllAlarms(): Promise<number> {
    const db = getDb();
    if (!db) return 0;
    const result = await run(`UPDATE iot_history SET resolved = 1 WHERE alert = 1 AND resolved = 0`);
    return result.changes;
  }

  async commandActuator(id: string, state: boolean | number): Promise<{ success: boolean; message: string }> {
    const db = getDb();
    if (!db) return { success: false, message: 'SQLite non initialisé' };

    const existing = await this.getActuatorState(id);
    if (!existing) return { success: false, message: `Actionneur ${id} introuvable` };

    const isOn = typeof state === 'boolean' ? state : Boolean(state);
    await this.upsertActuatorState({
      id: existing.id,
      name: existing.name,
      type: existing.type,
      isOn,
      position: existing.position,
    });

    try {
      const response = await fetch('/api/device/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, state: isOn, type: existing.type }),
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return { success: true, message: data.message ?? `Commande envoyée à ${existing.name}` };
      }
    } catch {
      // ignore network errors, local state is still updated
    }

    return { success: true, message: `État local mis à jour pour ${existing.name}` };
  }

  async readSensor(id: string): Promise<{ success: boolean; value?: number; unit?: string; message: string }> {
    const db = getDb();
    if (!db) return { success: false, message: 'SQLite non initialisé' };

    const config = await this.getSensorConfig(id);
    if (!config) return { success: false, message: `Capteur ${id} introuvable` };

    try {
      const response = await fetch(`/api/device/sensor?id=${encodeURIComponent(id)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.value !== undefined) {
          await this.upsertSensorConfig({
            id: config.id,
            name: config.name,
            type: config.type,
            value: Number(data.value),
            unit: data.unit ?? config.unit,
            threshold: config.threshold,
          });
          return { success: true, value: Number(data.value), unit: data.unit ?? config.unit, message: `${config.name}: ${data.value}${data.unit ?? config.unit}` };
        }
      }
    } catch {
      // ignore network errors, return cached value
    }

    return { success: true, value: config.value, unit: config.unit, message: `${config.name}: ${config.value}${config.unit} (cache local)` };
  }

  async getDeviceStatus(): Promise<{ sensors: Array<{ id: string; name: string; type: string; value: number; unit: string; threshold: number }>; actuators: Array<{ id: string; name: string; type: string; isOn: boolean; position: number | null }> }> {
    const sensors = await this.getAllSensorConfigs();
    const actuators = await this.getAllActuatorStates();
    return {
      sensors: sensors.map((s) => ({ id: s.id, name: s.name, type: s.type, value: s.value, unit: s.unit, threshold: s.threshold })),
      actuators: actuators.map((a) => ({ id: a.id, name: a.name, type: a.type, isOn: a.isOn, position: a.position })),
    };
  }

  async getAllDevices(): Promise<Device[]> {
    const db = getDb();
    if (!db) return [];
    const results = await query<{ id: string; name: string; type: string; subtype: string | null; ip_address: string | null; port: number | null; is_active: number; metadata: string; created_at: string; updated_at: string }>(`SELECT * FROM devices ORDER BY updated_at DESC`);
    return results.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type as Device["type"],
      subtype: row.subtype,
      ipAddress: row.ip_address,
      port: row.port,
      isActive: Boolean(row.is_active),
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getDevice(id: string): Promise<Device | null> {
    const db = getDb();
    if (!db) return null;
    const results = await query<{ id: string; name: string; type: string; subtype: string | null; ip_address: string | null; port: number | null; is_active: number; metadata: string; created_at: string; updated_at: string }>(`SELECT * FROM devices WHERE id = ?`, [id]);
    if (results.length === 0) return null;
    const row = results[0];
    return {
      id: row.id,
      name: row.name,
      type: row.type as Device["type"],
      subtype: row.subtype,
      ipAddress: row.ip_address,
      port: row.port,
      isActive: Boolean(row.is_active),
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async upsertDevice(device: { id: string; name: string; type: Device["type"]; subtype?: string | null; ipAddress?: string | null; port?: number | null; isActive?: boolean; metadata?: Record<string, unknown> }): Promise<Device> {
    const db = getDb();
    if (!db) throw new Error('SQLite non initialisé');
    const existing = await this.getDevice(device.id);
    const oldMetadata = existing ? existing.metadata : {};
    const metadata = { ...oldMetadata, ...(device.metadata ?? {}) };
    await run(
      `INSERT INTO devices (id, name, type, subtype, ip_address, port, is_active, metadata, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET name = excluded.name, type = excluded.type, subtype = excluded.subtype, ip_address = excluded.ip_address, port = excluded.port, is_active = excluded.is_active, metadata = excluded.metadata, updated_at = excluded.updated_at`,
      [device.id, device.name, device.type, device.subtype ?? null, device.ipAddress ?? null, device.port ?? null, device.isActive ?? true ? 1 : 0, JSON.stringify(metadata)]
    );
    const row = await this.getDevice(device.id);
    return row!;
  }

  async deleteDevice(id: string): Promise<boolean> {
    const db = getDb();
    if (!db) return false;
    const result = await run(`DELETE FROM devices WHERE id = ?`, [id]);
    return result.changes > 0;
  }

  async testDeviceConnection(ipAddress: string, port?: number | null): Promise<{ success: boolean; message: string; latency?: number }> {
    const url = `http://${ipAddress}${port ? `:${port}` : ''}/api/health`;
    const start = Date.now();
    try {
      const response = await fetch(url, { method: 'GET', mode: 'cors', signal: AbortSignal.timeout(3000) });
      const latency = Date.now() - start;
      if (response.ok) {
        return { success: true, message: `Connexion réussie (${latency}ms)`, latency };
      }
      return { success: false, message: `Réponse HTTP ${response.status}` };
    } catch {
      const latency = Date.now() - start;
      return { success: false, message: `Impossible de joindre l'appareil (${latency}ms)` };
    }
  }

  async scanLocalDevices(): Promise<Device[]> {
    const candidates: Array<{ ip: string; port: number; type: Device["type"]; subtype: string | null }> = [
      { ip: "192.168.1.100", port: 8080, type: "camera", subtype: "ip" },
      { ip: "192.168.1.101", port: 8080, type: "sensor", subtype: "microphone" },
      { ip: "192.168.1.102", port: 8080, type: "sensor", subtype: "temperature" },
      { ip: "192.168.1.103", port: 8080, type: "actuator", subtype: "relay" },
      { ip: "192.168.1.104", port: 8080, type: "actuator", subtype: "servo" },
      { ip: "192.168.1.105", port: 8080, type: "camera", subtype: "rtsp" },
    ];

    const discovered: Device[] = [];
    for (const candidate of candidates) {
      const result = await this.testDeviceConnection(candidate.ip, candidate.port);
      if (result.success) {
        discovered.push({
          id: `${candidate.subtype ?? candidate.type}-${candidate.ip.replace(/\./g, "-")}`,
          name: `${candidate.subtype ?? candidate.type} ${candidate.ip}`,
          type: candidate.type,
          subtype: candidate.subtype,
          ipAddress: candidate.ip,
          port: candidate.port,
          isActive: true,
          metadata: { discoveredAt: new Date().toISOString() },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    return discovered;
  }

  async detectBridge(): Promise<{ detected: boolean; url?: string; latency?: number }> {
    const bridgeCandidates = [
      { host: "localhost", port: 8080 },
      { host: "127.0.0.1", port: 8080 },
      { host: window.location.hostname || "localhost", port: 8080 },
    ];

    for (const candidate of bridgeCandidates) {
      const url = `http://${candidate.host}:${candidate.port}/api/health`;
      const start = Date.now();
      try {
        const response = await fetch(url, { method: "GET", mode: "cors", signal: AbortSignal.timeout(2000) });
        const latency = Date.now() - start;
        if (response.ok) {
          return { detected: true, url: `ws://${candidate.host}:${candidate.port}/ws`, latency };
        }
      } catch {
        // ignore
      }
    }
    return { detected: false };
  }

  async connectBridge(url: string): Promise<{ success: boolean; message: string }> {
    try {
      const ws = new WebSocket(url);
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve({ success: false, message: "Timeout lors de la connexion au bridge" });
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.send(JSON.stringify({ type: "ping", time: Date.now() }));
          resolve({ success: true, message: "Connecté au bridge physique" });
          ws.close();
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          resolve({ success: false, message: "Erreur de connexion au bridge" });
        };
      });
    } catch {
      return { success: false, message: "Impossible de se connecter au bridge" };
    }
  }

  async exportDevices(): Promise<string> {
    const devices = await this.getAllDevices();
    return JSON.stringify(devices, null, 2);
  }

  async importDevices(json: string): Promise<{ imported: number }> {
    try {
      const devices = JSON.parse(json) as Device[];
      let imported = 0;
      for (const device of devices) {
        try {
          await this.upsertDevice(device);
          imported++;
        } catch {
          // ignore individual import errors
        }
      }
      return { imported };
    } catch {
      return { imported: 0 };
    }
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

