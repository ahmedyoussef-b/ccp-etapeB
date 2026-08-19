'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { clientEngine } from '@/lib/client-engine';

export function SyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSync = async () => {
    setShowSuccess(false);
    setError(null);
    setIsSyncing(true);

    try {
      await clientEngine.init();
      const payload = await clientEngine.exportAll();

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Sync failed: ${response.status}`);
      }

      try {
        const imagesResponse = await fetch('/api/images/sync-metadata');
        if (imagesResponse.ok) {
          const data = await imagesResponse.json();
          if (data.images && Array.isArray(data.images)) {
            await clientEngine.syncImageMetadata(data.images);
          }
        }
      } catch (imageErr) {
        console.error('[SyncButton] Image metadata sync failed:', imageErr);
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  if (isSyncing) {
    return (
      <Button variant="outline" disabled>
        <RefreshCw className="h-4 w-4 animate-spin" />
        Synchronisation...
      </Button>
    );
  }

  if (showSuccess) {
    return (
      <Button variant="outline" disabled>
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        Synchronisé
      </Button>
    );
  }

  if (error) {
    return (
      <Button variant="destructive" onClick={handleSync}>
        <XCircle className="h-4 w-4" />
        Réessayer
      </Button>
    );
  }

  return (
    <Button variant="outline" onClick={handleSync}>
      <RefreshCw className="h-4 w-4" />
      Synchroniser
    </Button>
  );
}
