import { query, queryOne, run } from '@/lib/client-engine/sqlite';

export interface Folder {
  id?: number;
  remoteId: string;
  name: string;
  parentId: number | null;
  order: number;
  path?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface File {
  id?: number;
  remoteId: string;
  name: string;
  folderId: number | null;
  order: number;
  size: number;
  path?: string;
  content?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalTreeNode {
  id?: number;
  remoteId: string;
  name: string;
  type: 'folder' | 'file' | 'meta';
  parentId: number | null;
  order: number;
  path: string;
  size?: number;
  content?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface LocalTreeRow {
  id: number;
  remote_id: string;
  name: string;
  type: string;
  parent_id: number | null;
  node_order: number;
  path: string | null;
  size: number | null;
  content: string | null;
  created_at: string;
  updated_at: string;
}

export async function getAllFolders(): Promise<Folder[]> {
  const rows = await query<LocalTreeRow>(`
    SELECT * FROM local_tree WHERE type = 'folder' ORDER BY parent_id ASC, node_order ASC
  `);
  return rows.map((row) => ({
    id: row.id,
    remoteId: row.remote_id,
    name: row.name,
    parentId: row.parent_id,
    order: row.node_order ?? 0,
    path: row.path ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

export async function getAllFiles(): Promise<File[]> {
  const rows = await query<LocalTreeRow>(`
    SELECT * FROM local_tree WHERE type = 'file' ORDER BY parent_id ASC, node_order ASC
  `);
  return rows.map((row) => ({
    id: row.id,
    remoteId: row.remote_id,
    name: row.name,
    folderId: row.parent_id,
    order: row.node_order ?? 0,
    size: row.size ?? 0,
    path: row.path ?? undefined,
    content: row.content,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

export async function getFolderByRemoteId(remoteId: string): Promise<Folder | undefined> {
  const row = await queryOne<LocalTreeRow>(
    'SELECT * FROM local_tree WHERE remote_id = ? AND type = \'folder\' LIMIT 1',
    [remoteId]
  );
  if (!row) return undefined;
  return {
    id: row.id,
    remoteId: row.remote_id,
    name: row.name,
    parentId: row.parent_id,
    order: row.node_order ?? 0,
    path: row.path ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export interface AddFolderInput {
  remoteId: string;
  name: string;
  parentId: number | null;
  order?: number;
  content?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export async function addFolder(folder: AddFolderInput): Promise<number> {
  const result = await run(
    'INSERT INTO local_tree (remote_id, name, type, parent_id, node_order, content, created_at, updated_at) VALUES (?, ?, \'folder\', ?, ?, NULL, datetime(\'now\'), datetime(\'now\'))',
    [folder.remoteId, folder.name, folder.parentId, folder.order ?? 0]
  );
  return result.lastInsertRowid;
}

export async function updateFolder(
  id: number,
  updates: Partial<Pick<Folder, 'name' | 'parentId' | 'order'>>
): Promise<void> {
  const sets: string[] = ['updated_at = datetime(\'now\')'];
  const params: unknown[] = [];
  if (updates.name !== undefined) {
    sets.push('name = ?');
    params.push(updates.name);
  }
  if (updates.parentId !== undefined) {
    sets.push('parent_id = ?');
    params.push(updates.parentId);
  }
  if (updates.order !== undefined) {
    sets.push('node_order = ?');
    params.push(updates.order);
  }
  params.push(id);
  await run(`UPDATE local_tree SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function getFileByNameAndFolder(name: string, folderId: number | null): Promise<File | undefined> {
  const row = await queryOne<LocalTreeRow>(
    'SELECT * FROM local_tree WHERE name = ? AND parent_id = ? AND type = \'file\' LIMIT 1',
    [name, folderId]
  );
  if (!row) return undefined;
  return {
    id: row.id,
    remoteId: row.remote_id,
    name: row.name,
    folderId: row.parent_id,
    order: row.node_order ?? 0,
    size: row.size ?? 0,
    path: row.path ?? undefined,
    content: row.content,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export interface AddFileInput {
  remoteId: string;
  name: string;
  folderId: number | null;
  order?: number;
  size: number;
  content?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export async function addFile(file: AddFileInput): Promise<number> {
  const result = await run(
    'INSERT INTO local_tree (remote_id, name, type, parent_id, node_order, size, content, created_at, updated_at) VALUES (?, ?, \'file\', ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))',
    [file.remoteId, file.name, file.folderId, file.order ?? 0, file.size, file.content ?? null]
  );
  return result.lastInsertRowid;
}

export async function deleteLocalTreeNode(id: number): Promise<void> {
  await run('DELETE FROM local_tree WHERE id = ?', [id]);
}

const DB_MAX_RECORDS = 1000;

export async function purgeOldLocalTreeRecords(): Promise<number> {
  const countResult = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM local_tree');
  const count = countResult?.count ?? 0;
  if (count <= DB_MAX_RECORDS) {
    return 0;
  }
  const excess = count - DB_MAX_RECORDS;
  const result = await run(`DELETE FROM local_tree WHERE id IN (SELECT id FROM local_tree ORDER BY created_at ASC LIMIT ?)`, [excess]);
  return result.changes;
}
