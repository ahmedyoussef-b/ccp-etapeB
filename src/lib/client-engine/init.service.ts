import { initSQLite, query, run } from './sqlite';
import { initVectorStore, getAllDocuments } from './vector-store';
import { initJsonStore } from './json-store';

export interface InitOptions {
    autoSync?: boolean;
    autoVectorize?: boolean;
}

export interface InitResult {
    sqlite: boolean;
    vector: boolean;
    json: boolean;
    sync: boolean;
    vectorized: number;
    errors: string[];
}

export class DatabaseInitService {
    private static instance: DatabaseInitService;
    private initialized = false;
    private initPromise: Promise<InitResult> | null = null;

    static getInstance(): DatabaseInitService {
        if (!this.instance) {
            this.instance = new DatabaseInitService();
        }
        return this.instance;
    }

    async initialize(options: InitOptions = {}): Promise<InitResult> {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this.doInitialize(options);
        return this.initPromise;
    }

    private async doInitialize(options: InitOptions): Promise<InitResult> {
        const result: InitResult = {
            sqlite: false,
            vector: false,
            json: false,
            sync: false,
            vectorized: 0,
            errors: []
        };

        const { autoSync = true, autoVectorize = true } = options;

        try {
            await initSQLite();
            result.sqlite = true;
            console.log('[DB Init] ✅ SQLite initialized');
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'unknown error';
            result.errors.push(`SQLite: ${msg}`);
            console.error('[DB Init] ❌ SQLite failed:', msg);
        }

        try {
            await initVectorStore();
            result.vector = true;
            console.log('[DB Init] ✅ Vector store initialized');
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'unknown error';
            result.errors.push(`Vector: ${msg}`);
            console.error('[DB Init] ❌ Vector store failed:', msg);
        }

        try {
            await initJsonStore();
            result.json = true;
            console.log('[DB Init] ✅ JSON store initialized');
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'unknown error';
            result.errors.push(`JSON: ${msg}`);
            console.error('[DB Init] ❌ JSON store failed:', msg);
        }

        if (autoSync && result.sqlite) {
            try {
                const { syncManager } = await import('@/lib/sync/sync-manager');
                const syncResult = await syncManager.syncTable('local_tree');
                result.sync = syncResult.errors.length === 0;
                if (result.sync) {
                    console.log(`[DB Init] ✅ Sync completed: ${syncResult.pulled || 0} pulled`);
                } else {
                    result.errors.push(`Sync: ${syncResult.errors.join(', ')}`);
                    console.warn('[DB Init] ⚠️ Sync partial:', syncResult.errors);
                }
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'unknown error';
                result.errors.push(`Sync: ${msg}`);
                console.error('[DB Init] ❌ Sync failed:', msg);
            }
        }

        if (autoVectorize && result.vector && result.sync) {
            try {
                const isFirstRun = await this.checkFirstRun();

                if (isFirstRun) {
                    console.log('[DB Init] 🚀 First run detected - full vectorization...');
                    const { addDocument } = await import('./vector-store');
                    const { getAllFiles } = await import('@/lib/db/db');

                    const files = await getAllFiles();
                    let count = 0;

                    for (const file of files) {
                        if (file.content && file.content.length > 0) {
                            try {
                                const embedding = this.simpleEmbedding(file.content);
                                const docId = `file-${String(file.id ?? Date.now())}`;
                                await addDocument({
                                    id: docId,
                                    name: file.name,
                                    originalPath: file.path || file.name,
                                    relativePath: file.path || file.name,
                                    chunks: [{
                                        documentId: docId,
                                        documentName: file.name,
                                        chunkIndex: 0,
                                        content: file.content,
                                        embedding: embedding,
                                        metadata: {}
                                    }],
                                    metadata: {}
                                });
                                count++;
                            } catch (e) {
                                console.warn(`[DB Init] Vectorization failed for ${file.name}:`, e);
                            }
                        }
                    }

                    result.vectorized = count;
                    await this.markFirstRunComplete();
                    console.log(`[DB Init] ✅ First run: ${count} documents vectorized`);
                } else {
                    console.log('[DB Init] Incremental vectorization...');
                    const { addDocument } = await import('./vector-store');
                    const { getAllFiles } = await import('@/lib/db/db');

                    const files = await getAllFiles();
                    const existingDocs = await getAllDocuments();
                    const existingIds = new Set(existingDocs.map(d => d.id));

                    let count = 0;
                    for (const file of files) {
                        if (file.content && file.content.length > 0 && !existingIds.has(`file-${String(file.id ?? '')}`)) {
                            try {
                                const embedding = this.simpleEmbedding(file.content);
                                const docId = `file-${String(file.id ?? Date.now())}`;
                                await addDocument({
                                    id: docId,
                                    name: file.name,
                                    originalPath: file.path || file.name,
                                    relativePath: file.path || file.name,
                                    chunks: [{
                                        documentId: docId,
                                        documentName: file.name,
                                        chunkIndex: 0,
                                        content: file.content,
                                        embedding: embedding,
                                        metadata: {}
                                    }],
                                    metadata: {}
                                });
                                count++;
                            } catch (e) {
                                console.warn(`[DB Init] Vectorization failed for ${file.name}:`, e);
                            }
                        }
                    }
                    result.vectorized = count;
                    console.log(`[DB Init] ✅ ${count} new documents vectorized`);
                }
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'unknown';
                result.errors.push(`Vectorize: ${msg}`);
                console.error('[DB Init] ❌ Vectorization failed:', msg);
            }
        }

        this.initialized = result.sqlite && result.vector && result.json;
        return result;
    }

    private async checkFirstRun(): Promise<boolean> {
        try {
            const rows = await query("SELECT value FROM json_store WHERE key = 'nexaflow_first_run'");
            return rows.length === 0;
        } catch {
            return true;
        }
    }

    private async markFirstRunComplete(): Promise<void> {
        try {
            await run(
                "INSERT OR REPLACE INTO json_store (key, value, syncStatus, updatedAt) VALUES (?, ?, ?, ?)",
                ['nexaflow_first_run', JSON.stringify({ completed: true, timestamp: Date.now() }), 'synced', Date.now()]
            );
        } catch (e) {
            console.warn('[DB Init] Could not mark first run:', e);
        }
    }

    private simpleEmbedding(text: string, dims: number = 384): number[] {
        const tokens = text.toLowerCase().split(/\s+/);
        const embedding = new Array(dims).fill(0);
        for (const token of tokens) {
            let hash = 0;
            for (let i = 0; i < token.length; i++) {
                hash = ((hash << 5) - hash) + token.charCodeAt(i);
                hash = hash & hash;
            }
            const idx = Math.abs(hash) % dims;
            embedding[idx] += 0.1;
        }
        const norm = Math.sqrt(embedding.reduce((a, b) => a + b * b, 0));
        return embedding.map(v => v / (norm || 1));
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    reset(): void {
        this.initialized = false;
        this.initPromise = null;
    }
}

export const dbInitService = DatabaseInitService.getInstance();
