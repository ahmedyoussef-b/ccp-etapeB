import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getFolderByRemoteId,
  addFolder,
  updateFolder,
  getFileByNameAndFolder,
  addFile,
} from '@/lib/db/db';
import type { ApiNode, ApiFolderNode, ApiFileNode } from './types';

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
  const remoteId = String(node.id);
  const localFolder = await getFolderByRemoteId(remoteId);

  let targetFolderId: number;

  if (localFolder) {
    targetFolderId = localFolder.id!;
    await updateFolder(localFolder.id!, {
      name: node.name,
      order: node.order ?? 0,
    });
  } else {
    targetFolderId = await addFolder({
      remoteId,
      name: node.name,
      parentId,
      order: node.order ?? 0,
    });
  }

  if (node.children && node.children.length > 0) {
    await importTree(node.children, targetFolderId);
  }
}

async function importFile(node: ApiFileNode, parentId: number | null): Promise<void> {
  const existingFile = await getFileByNameAndFolder(node.name, parentId);
  const fileContent = node.content ?? node.metadata ?? null;

  if (existingFile) {
    const { newName } = await generateNextFilename(parentId, node.name);
    await addFile({
      remoteId: String(node.id),
      name: newName,
      folderId: parentId,
      order: node.order ?? 0,
      size: node.size,
      content: fileContent,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    await addFile({
      remoteId: String(node.id),
      name: node.name,
      folderId: parentId,
      order: node.order ?? 0,
      size: node.size,
      content: fileContent,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
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

    const existing = await getFileByNameAndFolder(candidate, folderId);
    if (!existing) break;
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
      const data = (await response.json()) as { tree: ApiNode[]; lastSyncTimestamp: string };
      return data.tree;
    },
    onSuccess: async (tree) => {
      await importTree(tree, null);
      toast.success('Synchronisation terminée avec succès');
      queryClient.invalidateQueries({ queryKey: ['sync'] });
    },
    onError: (error: Error) => {
      toast.error(`Erreur de synchronisation: ${error.message}`);
    },
  });

  return {
    sync: syncMutation.mutateAsync,
    isSyncing: syncMutation.isPending,
    error: syncMutation.error,
    isSuccess: syncMutation.isSuccess,
  };
}
