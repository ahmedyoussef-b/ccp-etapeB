import { useState } from 'react';
import { toast } from 'sonner';
import { importTree } from '@/lib/sync/useSyncData';

interface DownloadState {
  isDownloading: boolean;
  progress: number;
  total: number;
  current: number;
  error: string | null;
}

export function useDirectoryDownload() {
  const [state, setState] = useState<DownloadState>({
    isDownloading: false,
    progress: 0,
    total: 0,
    current: 0,
    error: null,
  });

  const downloadDirectory = async (directoryId: number | string, directoryName: string) => {
    setState({
      isDownloading: true,
      progress: 0,
      total: 0,
      current: 0,
      error: null,
    });

    const toastId = toast.loading(`📥 Téléchargement de "${directoryName}" en cours...`, {
      duration: Infinity,
    });

    try {
      console.log(`[NexaFlow][useDirectoryDownload] Début du téléchargement : ${directoryName} (${directoryId})`);

      const response = await fetch('/api/sync/download-directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directoryId: Number(directoryId) }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log(`[NexaFlow][useDirectoryDownload] Données reçues : ${data.count} éléments`);

      setState((prev) => ({
        ...prev,
        total: data.count,
        current: 0,
      }));

      await importTree(data.directory, null);

      console.log(`[NexaFlow][useDirectoryDownload] Import terminé avec succès`);

      toast.success(`✅ "${directoryName}" téléchargé (${data.count} éléments)`, {
        id: toastId,
        duration: 5000,
      });

      setState({
        isDownloading: false,
        progress: 100,
        total: data.count,
        current: data.count,
        error: null,
      });

      return data;
    } catch (error) {
      console.error('[NexaFlow][useDirectoryDownload] Erreur:', error);

      toast.error(`❌ Échec du téléchargement de "${directoryName}"`, {
        id: toastId,
        duration: 5000,
      });

      setState({
        isDownloading: false,
        progress: 0,
        total: 0,
        current: 0,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      });

      throw error;
    }
  };

  const reset = () => {
    setState({
      isDownloading: false,
      progress: 0,
      total: 0,
      current: 0,
      error: null,
    });
  };

  return { downloadDirectory, reset, ...state };
}
