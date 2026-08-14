import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { db } from '@/lib/db/db';
import type { ApiNode, ApiFolderNode, ApiFileNode } from './types';
import type { File } from '@/lib/db/db';

async function importTree(nodes: ApiNode[], parentId: number | null): Promise<void> {
  for (const node of nodes) {
    if (node.type === 'folder') {
      await importFolder(node as ApiFolderNode, parentId);
    } else if (node.type === 'file') {
      await importFile(node as ApiFileNode, parentId);
    }
  }
}

async function importFolder(node: ApiFolderNode, parentId: number | null): Promise<void> {
  const localFolder = await db.folders.where('remoteId').equals(node.id).first();

  let targetFolderId: number;

  if (localFolder) {
    targetFolderId = localFolder.id!;
    await db.folders.update(localFolder.id!, {
      name: node.name,
      updatedAt: new Date(),
    });
  } else {
    targetFolderId = await db.folders.add({
      remoteId: node.id,
      name: node.name,
      parentId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  if (node.children && node.children.length > 0) {
    await importTree(node.children, targetFolderId);
  }
}

async function importFile(node: ApiFileNode, parentId: number | null): Promise<void> {
  const existingFile = await findExistingFile(parentId, node.name);

  if (existingFile) {
    const { newName } = await generateNextFilename(parentId, node.name);
    await db.files.add({
      remoteId: node.id,
      name: newName,
      folderId: parentId,
      size: node.size,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    await db.files.add({
      remoteId: node.id,
      name: node.name,
      folderId: parentId,
      size: node.size,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

async function findExistingFile(folderId: number | null, name: string): Promise<File | undefined> {
  const candidates = await db.files.where('name').equals(name).toArray();
  return candidates.find(f => f.folderId === folderId);
}

async function generateNextFilename(folderId: number | null, originalName: string): Promise<{ newName: string }> {
  const lastDotIndex = originalName.lastIndexOf('.');
  let baseName: string;
  let extension: string;

  if (lastDotIndex > 0) {
    baseName = originalName.slice(0, lastDotIndex);
    extension = originalName.slice(lastDotIndex + 1);
  } else {
    baseName = originalName;
    extension = '';
  }

  let index = 1;
  let candidate: string;

  do {
    if (extension) {
      candidate = `${baseName}_${index}.${extension}`;
    } else {
      candidate = `${baseName}_${index}`;
    }
    index++;

    const allWithName = await db.files.where('name').equals(candidate).toArray();
    const conflict = allWithName.some(f => f.folderId === folderId);
    if (!conflict) break;
  } while (true);

  return { newName: candidate };
}

export function useSyncData() {
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: async (): Promise<ApiNode[]> => {
      const response = await fetch('/api/sync/get-all-data');
      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
      }
      const data = (await response.json()) as { tree: ApiNode[] };
      return data.tree;
    },
    onSuccess: async (tree) => {
      await db.transaction('rw', [db.folders, db.files], async () => {
        await importTree(tree, null);
      });
      toast.success('Synchronisation terminée avec succès');
      queryClient.invalidateQueries({ queryKey: ['sync'] });
    },
    onError: (error: Error) => {
      toast.error(`Erreur de synchronisation: ${error.message}`);
    },
  });

  return {
    sync: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    error: syncMutation.error,
    isSuccess: syncMutation.isSuccess,
  };
}
