'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ImageOff, Play } from 'lucide-react';
import { LazyMediaLoader } from '@/lib/media/lazy-media-loader.service';
import type { MediaLoadResult } from '@/lib/media/lazy-media-loader.service';

interface MediaPreviewProps {
  nodeId: string;
  title?: string;
  kind?: 'image' | 'video';
  onLoad?: (result: MediaLoadResult) => void;
  onError?: (error: Error) => void;
  className?: string;
  onClick?: () => void;
}

export function MediaPreview({
  nodeId,
  title,
  kind = 'image',
  onLoad,
  onError,
  className = '',
  onClick,
}: MediaPreviewProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLoad = useCallback(async () => {
    if (status === 'loading' || dataUrl) return;

    setStatus('loading');
    setErrorMessage(null);

    try {
      const result = await LazyMediaLoader.loadMedia(nodeId);
      setDataUrl(result.dataUrl);
      setStatus('loaded');
      onLoad?.(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setStatus('error');
      setErrorMessage(err.message);
      onError?.(err);
    }
  }, [nodeId, status, dataUrl, onLoad, onError]);

  const handleRetry = useCallback(() => {
    setStatus('idle');
    setDataUrl(null);
    setErrorMessage(null);
    handleLoad();
  }, [handleLoad]);

  if (status === 'loaded' && dataUrl) {
    if (kind === 'video') {
      return (
        <video
          src={dataUrl}
          controls
          className={`max-h-[520px] w-full rounded ${className}`}
          onClick={onClick}
        />
      );
    }
    return (
      <img
        src={dataUrl}
        alt={title || 'Média'}
        className={`max-h-[520px] w-full object-contain rounded ${className}`}
        onClick={onClick}
      />
    );
  }

  if (status === 'error') {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 p-4 border border-dashed rounded ${className}`}>
        <ImageOff className="h-8 w-8 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Erreur de chargement</p>
        <p className="text-xs text-red-500">{errorMessage}</p>
        <Button size="sm" variant="outline" onClick={handleRetry}>
          Réessayer
        </Button>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 p-4 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-2 p-4 border border-dashed rounded hover:border-primary/50 transition-colors ${className}`}>
      {kind === 'video' ? (
        <Play className="h-8 w-8 text-muted-foreground" />
      ) : (
        <ImageOff className="h-8 w-8 text-muted-foreground" />
      )}
      <p className="text-xs text-muted-foreground">{title || 'Média'}</p>
      <Button size="sm" variant="outline" onClick={handleLoad}>
        Charger
      </Button>
    </div>
  );
}
