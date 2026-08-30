'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { csrfFetch } from '@/lib/procedures/csrf-fetch';

async function fetchWebTree() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await fetch('/api/tree');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!res.ok) throw new Error('Failed to fetch web tree');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any).roots || [];
}

async function fetchImageTree() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await fetch('/api/images/tree');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!res.ok) throw new Error('Failed to fetch image tree');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any).roots || [];
}

export function useWebTreeQuery() {
  return useQuery({
    queryKey: ['webTree'],
    queryFn: fetchWebTree,
  });
}

export function useImageTreeQuery() {
  return useQuery({
    queryKey: ['imageTree'],
    queryFn: fetchImageTree,
  });
}

export function useResetWebMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await csrfFetch('/api/tree/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to reset web tree');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webTree'] });
      toast.success('BDD Web remise à zéro avec succès');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Reset failed';
      toast.error(`Erreur lors de la remise à zéro de la BDD Web: ${msg}`);
    },
  });
}

export function useCompressSqliteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tree/sqlite/compress', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to compress SQLite');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webTree'] });
      toast.success('Base SQLite compressée');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Compression failed';
      toast.error(`Erreur lors de la compression: ${msg}`);
    },
  });
}

export function useReindexVectorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tree/vector/reindex', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to reindex vector');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webTree'] });
      toast.success('Réindexation vectorielle terminée');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Reindex failed';
      toast.error(`Erreur lors de la réindexation: ${msg}`);
    },
  });
}

export function useDeleteImageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (imageId: string) => {
      const res = await csrfFetch(`/api/images/${encodeURIComponent(imageId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete image');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imageTree'] });
      toast.success('Image supprimée');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      toast.error(`Erreur lors de la suppression: ${msg}`);
    },
  });
}

export function useRenameImageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ imageId, name }: { imageId: string; name: string }) => {
      const res = await csrfFetch(`/api/images/${encodeURIComponent(imageId)}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to rename image');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imageTree'] });
      toast.success('Image renommée');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Rename failed';
      toast.error(`Erreur lors du renommage: ${msg}`);
    },
  });
}

export function useEditImageMetadataMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ imageId, metadata }: { imageId: string; metadata: Record<string, unknown> }) => {
      const res = await csrfFetch(`/api/images/${encodeURIComponent(imageId)}/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      });
      if (!res.ok) throw new Error('Failed to update metadata');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imageTree'] });
      toast.success('Métadonnées mises à jour');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Update failed';
      toast.error(`Erreur lors de la mise à jour: ${msg}`);
    },
  });
}

export function useHardResetLocalTreeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tree/hard-reset', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to hard reset local tree');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webTree'] });
      toast.success('Hard Reset terminé: arborescence locale réinitialisée depuis le Web');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Hard reset failed';
      toast.error(`Erreur lors du hard reset: ${msg}`);
    },
  });
}

export function useSyncTreeWebToLocalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tree/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to sync web to local');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webTree'] });
      toast.success('Synchronisation miroir terminée');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      toast.error(`Erreur lors de la synchronisation: ${msg}`);
    },
  });
}
