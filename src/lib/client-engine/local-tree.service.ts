export interface LocalTreeNode {
  id: number;
  uuid: string;
  remote_id: string | null;
  name: string;
  type: 'root' | 'directory' | 'file';
  parent_id: number | null;
  node_order: number;
  path: string;
  size: number;
  content: string | null;
  metadata: Record<string, unknown>;
  sync_status: string;
  created_at: number;
  updated_at: number;
  children?: LocalTreeNode[];
}

export class LocalTreeService {
  private static instance: LocalTreeService;

  static getInstance(): LocalTreeService {
    if (!this.instance) {
      this.instance = new LocalTreeService();
    }
    return this.instance;
  }

  async getTree(): Promise<LocalTreeNode[]> {
    const { query } = await import('@/lib/client-engine/sqlite');
    const rows = await query<Record<string, unknown>>('SELECT * FROM local_tree ORDER BY path');
    return this.buildTree(rows);
  }

  private buildTree(rows: Record<string, unknown>[]): LocalTreeNode[] {
    const map = new Map<number, LocalTreeNode>();
    const roots: LocalTreeNode[] = [];

    for (const row of rows) {
      const node: LocalTreeNode = {
        ...(row as unknown as LocalTreeNode),
        metadata: row.metadata ? JSON.parse(row.metadata as string) : {},
        children: [],
      };
      map.set(node.id, node);
    }

    for (const node of map.values()) {
      if (node.parent_id !== null && map.has(node.parent_id)) {
        const parent = map.get(node.parent_id)!;
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async getWebTree(): Promise<LocalTreeNode[]> {
    const response = await fetch('/api/tree');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return this.normalizeWebTree((data.roots || []) as Record<string, unknown>[]);
  }

  private normalizeWebTree(roots: Record<string, unknown>[], parentId: number | null = null): LocalTreeNode[] {
    const result: LocalTreeNode[] = [];
    for (const node of roots) {
      const normalized: LocalTreeNode = {
        id: Number(node.id) || 0,
        uuid: String(node.uuid || node.id || ''),
        remote_id: String(node.id ?? null),
        name: String(node.name || 'unnamed'),
        type: node.type === 'root' ? 'root' : node.type === 'directory' ? 'directory' : 'file',
        parent_id: parentId,
        node_order: Number(node.order) || 0,
        path: String(node.path || ''),
        size: Number(node.size) || 0,
        content: (node.content as string) || null,
        metadata: (node.metadata as Record<string, unknown>) || {},
        sync_status: 'synced',
        created_at: Date.now(),
        updated_at: Date.now(),
        children: [],
      };
      if (node.children && Array.isArray(node.children)) {
        normalized.children = this.normalizeWebTree(node.children as Record<string, unknown>[], normalized.id);
      }
      result.push(normalized);
    }
    return result;
  }

  async syncFromWeb(): Promise<{ inserted: number; errors: string[] }> {
    const webTree = await this.getWebTree();
    const { run } = await import('@/lib/client-engine/sqlite');
    let inserted = 0;
    const errors: string[] = [];

    const insertNode = async (node: LocalTreeNode) => {
      try {
        await run(
          `INSERT OR REPLACE INTO local_tree 
          (uuid, remote_id, name, type, parent_id, node_order, path, size, content, metadata, sync_status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            node.uuid || String(Date.now()),
            node.remote_id,
            node.name,
            node.type,
            node.parent_id,
            node.node_order,
            node.path,
            node.size,
            node.content || '',
            JSON.stringify(node.metadata || {}),
            'synced',
            node.created_at,
            node.updated_at,
          ]
        );
        inserted++;
        if (node.children) {
          for (const child of node.children) {
            await insertNode(child);
          }
        }
      } catch (e) {
        errors.push(`Node ${node.name}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    };

    for (const node of webTree) {
      await insertNode(node);
    }

    return { inserted, errors };
  }

  async createFolder(parentId: number | null, name: string): Promise<LocalTreeNode> {
    const { run, query } = await import('@/lib/client-engine/sqlite');
    const path = await this.getPath(parentId, name);

    await run(
      `INSERT INTO local_tree 
      (uuid, remote_id, name, type, parent_id, node_order, path, size, content, metadata, sync_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(Date.now()),
        null,
        name,
        'directory',
        parentId,
        0,
        path,
        0,
        '',
        JSON.stringify({ createdAt: new Date().toISOString() }),
        'local',
        Date.now(),
        Date.now(),
      ]
    );

    const result = await query<Record<string, unknown>>('SELECT * FROM local_tree WHERE rowid = last_insert_rowid()');
    return { ...(result[0] as unknown as LocalTreeNode), metadata: JSON.parse((result[0].metadata as string) || '{}'), children: [] };
  }

  async createFile(parentId: number | null, name: string, content: string = ''): Promise<LocalTreeNode> {
    const { run, query } = await import('@/lib/client-engine/sqlite');
    const path = await this.getPath(parentId, name);

    await run(
      `INSERT INTO local_tree 
      (uuid, remote_id, name, type, parent_id, node_order, path, size, content, metadata, sync_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(Date.now()),
        null,
        name,
        'file',
        parentId,
        0,
        path,
        content.length,
        content,
        JSON.stringify({ createdAt: new Date().toISOString() }),
        'local',
        Date.now(),
        Date.now(),
      ]
    );

    const result = await query<Record<string, unknown>>('SELECT * FROM local_tree WHERE rowid = last_insert_rowid()');
    return { ...(result[0] as unknown as LocalTreeNode), metadata: JSON.parse((result[0].metadata as string) || '{}'), children: [] };
  }

  async renameNode(nodeId: number, newName: string): Promise<void> {
    const { run, query } = await import('@/lib/client-engine/sqlite');
    const node = await this.getNode(nodeId);
    if (!node) throw new Error('Nœud non trouvé');

    const parentPath = node.parent_id !== null ? await this.getPathById(node.parent_id) : '.data';
    const newPath = `${parentPath}/${newName}`;

    await run(`UPDATE local_tree SET name = ?, path = ?, updated_at = ? WHERE id = ?`, [
      newName,
      newPath,
      Date.now(),
      nodeId,
    ]);

    await this.updateChildPaths(nodeId, newPath);
  }

  async deleteNode(nodeId: number): Promise<void> {
    const { run } = await import('@/lib/client-engine/sqlite');
    await run(`DELETE FROM local_tree WHERE parent_id = ?`, [nodeId]);
    await run(`DELETE FROM local_tree WHERE id = ?`, [nodeId]);
  }

  async editFileContent(nodeId: number, content: string): Promise<void> {
    const { run } = await import('@/lib/client-engine/sqlite');
    await run(`UPDATE local_tree SET content = ?, size = ?, updated_at = ? WHERE id = ? AND type = 'file'`, [
      content,
      content.length,
      Date.now(),
      nodeId,
    ]);
  }

  async getNode(nodeId: number): Promise<LocalTreeNode | null> {
    const { query } = await import('@/lib/client-engine/sqlite');
    const result = await query<Record<string, unknown>>('SELECT * FROM local_tree WHERE id = ?', [nodeId]);
    if (result.length === 0) return null;
    return { ...(result[0] as unknown as LocalTreeNode), metadata: JSON.parse((result[0].metadata as string) || '{}'), children: [] };
  }

  private async getPath(parentId: number | null, name: string): Promise<string> {
    if (!parentId) return `.data/${name}`;
    const parent = await this.getNode(parentId);
    return parent ? `${parent.path}/${name}` : `.data/${name}`;
  }

  private async getPathById(nodeId: number): Promise<string> {
    const { query } = await import('@/lib/client-engine/sqlite');
    const result = await query<Record<string, unknown>>('SELECT path FROM local_tree WHERE id = ?', [nodeId]);
    return (result[0]?.path as string) || '.data';
  }

  private async updateChildPaths(parentId: number, newParentPath: string): Promise<void> {
    const { query, run } = await import('@/lib/client-engine/sqlite');
    const children = await query<Record<string, unknown>>('SELECT * FROM local_tree WHERE parent_id = ?', [parentId]);

    for (const child of children) {
      const newPath = `${newParentPath}/${child.name}`;
      await run(`UPDATE local_tree SET path = ? WHERE id = ?`, [newPath, child.id]);
      if (child.type === 'directory') {
        await this.updateChildPaths(child.id, newPath);
      }
    }
  }

  async clearAll(): Promise<void> {
    const { run } = await import('@/lib/client-engine/sqlite');
    await run(`DELETE FROM local_tree`);
  }

  async getStatus(): Promise<{ count: number; initialized: boolean }> {
    const { query } = await import('@/lib/client-engine/sqlite');
    try {
      const result = await query<Record<string, unknown>>('SELECT COUNT(*) as count FROM local_tree');
      return { count: Number(result[0]?.count || 0), initialized: true };
    } catch {
      return { count: 0, initialized: false };
    }
  }
}

export const localTreeService = LocalTreeService.getInstance();
