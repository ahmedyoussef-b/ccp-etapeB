import { getAllFolders, getAllFiles, deleteLocalTreeNode, addFolder, updateFolder, addFile } from '@/lib/db/db';
import { query } from '@/lib/client-engine';

export interface LocalTreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children: LocalTreeNode[];
  createdAt: string;
  updatedAt: string;
  size?: number;
  path: string;
  order: number;
  content?: string | null;
  docId?: string | null;
}

interface LocalTreeSQLiteRow {
  id: number;
  uuid: string | null;
  remote_id: string | null;
  name: string;
  type: string;
  parent_id: number | null;
  node_order: number;
  path: string | null;
  size: number;
  content: string | null;
  sync_status: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Charge l'arborescence locale directement depuis la table SQLite local_tree
 * et reconstruit la structure hiérarchique avec ses nœuds racines et enfants.
 */
export async function loadLocalTreeFromSQLite(): Promise<LocalTreeNode[]> {
  try {
    const rows = await query<LocalTreeSQLiteRow>(
      `SELECT id, uuid, remote_id, name, type, parent_id, node_order, path, size, content, sync_status, deleted_at, created_at, updated_at 
       FROM local_tree 
       WHERE deleted_at IS NULL 
       ORDER BY parent_id, node_order`
    );

    const map = new Map<number, LocalTreeNode>();
    const roots: LocalTreeNode[] = [];

    for (const row of rows) {
      const isFolder = row.type === 'directory' || row.type === 'folder' || row.type === 'root';
      const node: LocalTreeNode = {
        id: `local-${row.id}`,
        name: row.name,
        type: isFolder ? 'folder' : 'file',
        children: [],
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString(),
        size: row.size || 0,
        path: row.path || row.name,
        order: row.node_order ?? 0,
        content: row.content ?? null,
      };
      map.set(row.id, node);
    }

    for (const row of rows) {
      const node = map.get(row.id);
      if (!node) continue;
      if (row.parent_id !== null && map.has(row.parent_id)) {
        map.get(row.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortRecursively = (nodes: LocalTreeNode[]): LocalTreeNode[] =>
      nodes
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((n) => ({
          ...n,
          children: sortRecursively(n.children),
        }));

    return sortRecursively(roots);
  } catch (error) {
    console.error('[DB:TREE] Erreur lors du chargement de local_tree depuis SQLite:', error);
    return [];
  }
}

/**
 * Charge l'arborescence vectorielle directement depuis la base IndexedDB (Dexie)
 * via les VectorTreeNodes ou reconstruit la structure à partir des documents vectorisés.
 */
export async function loadVectorTreeFromIndexedDB(): Promise<LocalTreeNode[]> {
  try {
    const { clientEngine } = await import('@/lib/client-engine');
    const rawNodes = await clientEngine.getAllVectorTreeNodes();
    
    if (rawNodes.length > 0) {
      const map = new Map<string, LocalTreeNode>();
      const roots: LocalTreeNode[] = [];

      for (const raw of rawNodes) {
        const node: LocalTreeNode = {
          id: raw.id,
          name: raw.name,
          type: raw.type,
          children: [],
          createdAt: new Date(raw.createdAt || Date.now()).toISOString(),
          updatedAt: new Date(raw.updatedAt || Date.now()).toISOString(),
          path: raw.relativePath,
          order: raw.order ?? 0,
          content: raw.content ?? null,
          docId: raw.docId ?? null,
        };
        map.set(raw.id, node);
      }

      for (const raw of rawNodes) {
        const node = map.get(raw.id);
        if (!node) continue;
        if (raw.parentId && map.has(raw.parentId)) {
          map.get(raw.parentId)!.children.push(node);
        } else {
          roots.push(node);
        }
      }

      const sortRecursively = (nodes: LocalTreeNode[]): LocalTreeNode[] =>
        nodes
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((n) => ({
            ...n,
            children: sortRecursively(n.children),
          }));

      return sortRecursively(roots);
    }

    // Si pas de vectorTree mais des documents vectorisés, créer l'arborescence à partir des docs
    const docs = await clientEngine.getAllVectorDocuments();
    if (docs.length === 0) return [];

    const nodeMap = new Map<string, LocalTreeNode>();
    const roots: LocalTreeNode[] = [];

    for (const doc of docs) {
      const path = doc.relativePath || doc.originalPath || doc.name;
      const parts = path.split('/').filter(Boolean);
      let currPath = '';
      let parentNode: LocalTreeNode | null = null;

      for (let i = 0; i < parts.length; i++) {
        const isFile = i === parts.length - 1;
        const part = parts[i];
        currPath = currPath ? `${currPath}/${part}` : part;
        const nodeId = isFile ? `vdoc-${doc.id}` : `vfolder-${currPath}`;

        let node = nodeMap.get(nodeId);
        if (!node) {
          node = {
            id: nodeId,
            name: part,
            type: isFile ? 'file' : 'folder',
            children: [],
            createdAt: new Date(doc.createdAt || Date.now()).toISOString(),
            updatedAt: new Date(doc.updatedAt || Date.now()).toISOString(),
            path: currPath,
            order: i,
            content: isFile ? (doc.content || JSON.stringify(doc.chunks?.map((c) => c.content) || '')) : null,
          };
          nodeMap.set(nodeId, node);

          if (parentNode) {
            parentNode.children.push(node);
          } else {
            roots.push(node);
          }
        }
        parentNode = node;
      }
    }

    return roots;
  } catch (error) {
    console.error('[DB:TREE] Erreur lors du chargement de vectorTree depuis IndexedDB:', error);
    return [];
  }
}

export async function getLocalTree(): Promise<LocalTreeNode[]> {
  const folders = await getAllFolders();
  const files = await getAllFiles();

  const folderMap = new Map<number, LocalTreeNode>();
  const roots: LocalTreeNode[] = [];

  for (const folder of folders) {
    folderMap.set(folder.id!, {
      id: `folder-${folder.id}`,
      name: folder.name,
      type: 'folder',
      children: [],
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
      order: folder.order ?? 0,
      path: folder.path ?? "",
    });
  }

  for (const file of files) {
    const node: LocalTreeNode = {
      id: `file-${file.id}`,
      name: file.name,
      type: 'file',
      children: [],
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
      order: file.order ?? 0,
      size: file.size,
      path: file.path ?? "",
      content: file.content,
    };

    if (file.folderId && folderMap.has(file.folderId)) {
      folderMap.get(file.folderId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  for (const folder of folders) {
    if (folder.parentId && folderMap.has(folder.parentId)) {
      const node = folderMap.get(folder.id!)!;
      folderMap.get(folder.parentId)!.children.push(node);
    } else if (!folder.parentId || !folderMap.has(folder.parentId)) {
      const node = folderMap.get(folder.id!)!;
      roots.push(node);
    }
  }

  const sortByOrder = (nodes: LocalTreeNode[]): LocalTreeNode[] =>
    nodes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const sortRecursively = (nodes: LocalTreeNode[]): LocalTreeNode[] =>
    sortByOrder(nodes).map((node) => ({
      ...node,
      children: sortRecursively(node.children),
    }));

  return sortRecursively(roots);
}

export { deleteLocalTreeNode, addFolder, updateFolder, addFile };
