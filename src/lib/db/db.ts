import { query, queryOne, run } from '@/lib/client-engine/sqlite';

export interface Folder {
  id?: number;
  remoteId: string;
  name: string;
  parentId: number | null;
  path?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface File {
  id?: number;
  remoteId: string;
  name: string;
  folderId: number | null;
  size: number;
  path?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalTreeNode {
  id?: number;
  remoteId: string;
  name: string;
  type: 'folder' | 'file' | 'meta';
  parentId: number | null;
  path: string;
  size?: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function getAllFolders(): Promise<Folder[]> {
  const rows = await query<{ id: number; remote_id: string; name: string; parent_id: number | null; path: string | null; created_at: string; updated_at: string }>(`
    SELECT * FROM local_tree WHERE type = 'folder' ORDER BY created_at DESC
  `);
  return rows.map((row) => ({
    id: row.id,
    remoteId: row.remote_id,
    name: row.name,
    parentId: row.parent_id,
    path: row.path ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

export async function getAllFiles(): Promise<File[]> {
  const rows = await query<{ id: number; remote_id: string; name: string; parent_id: number | null; size: number | null; path: string | null; created_at: string; updated_at: string }>(`
    SELECT * FROM local_tree WHERE type = 'file' ORDER BY created_at DESC
  `);
  return rows.map((row) => ({
    id: row.id,
    remoteId: row.remote_id,
    name: row.name,
    folderId: row.parent_id,
    size: row.size ?? 0,
    path: row.path ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

export async function getFolderByRemoteId(remoteId: string): Promise<Folder | undefined> {
  const row = await queryOne<{ id: number; remote_id: string; name: string; parent_id: number | null; created_at: string; updated_at: string }>(
    'SELECT * FROM local_tree WHERE remote_id = ? AND type = "folder" LIMIT 1',
    [remoteId]
  );
  if (!row) return undefined;
  return {
    id: row.id,
    remoteId: row.remote_id,
    name: row.name,
    parentId: row.parent_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function addFolder(folder: Omit<Folder, 'id'>): Promise<number> {
  const result = await run(
    'INSERT INTO local_tree (remote_id, name, type, parent_id, created_at, updated_at) VALUES (?, ?, "folder", ?, datetime("now"), datetime("now"))',
    [folder.remoteId, folder.name, folder.parentId]
  );
  return result.lastInsertRowid;
}

export async function updateFolder(id: number, updates: Partial<Pick<Folder, 'name' | 'parentId'>>): Promise<void> {
  const sets: string[] = ['updated_at = datetime("now")'];
  const params: unknown[] = [];
  if (updates.name !== undefined) {
    sets.push('name = ?');
    params.push(updates.name);
  }
  if (updates.parentId !== undefined) {
    sets.push('parent_id = ?');
    params.push(updates.parentId);
  }
  params.push(id);
  await run(`UPDATE local_tree SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function getFileByNameAndFolder(name: string, folderId: number | null): Promise<File | undefined> {
  const row = await queryOne<{ id: number; remote_id: string; name: string; parent_id: number | null; size: number | null; created_at: string; updated_at: string }>(
    'SELECT * FROM local_tree WHERE name = ? AND parent_id = ? AND type = "file" LIMIT 1',
    [name, folderId]
  );
  if (!row) return undefined;
  return {
    id: row.id,
    remoteId: row.remote_id,
    name: row.name,
    folderId: row.parent_id,
    size: row.size ?? 0,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function addFile(file: Omit<File, 'id'>): Promise<number> {
  const result = await run(
    'INSERT INTO local_tree (remote_id, name, type, parent_id, size, created_at, updated_at) VALUES (?, ?, "file", ?, ?, datetime("now"), datetime("now"))',
    [file.remoteId, file.name, file.folderId, file.size]
  );
  return result.lastInsertRowid;
}

export async function deleteLocalTreeNode(id: number): Promise<void> {
  await run('DELETE FROM local_tree WHERE id = ?', [id]);
}
