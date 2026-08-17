import { getAllFolders, getAllFiles, deleteLocalTreeNode, addFolder, updateFolder, addFile } from '@/lib/db/db';

export interface LocalTreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children: LocalTreeNode[];
  createdAt: string;
  updatedAt: string;
  size?: number;
  path: string;
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
      size: file.size,
      path: file.path ?? "",
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

  return roots;
}

export { deleteLocalTreeNode, addFolder, updateFolder, addFile };
