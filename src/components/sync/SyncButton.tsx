'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { useSyncData } from '@/lib/sync/useSyncData';

export function SyncButton() {
  const { sync, isSyncing, error } = useSyncData();
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSync = async () => {
    setShowSuccess(false);
    try {
      await sync();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch {
      // Error is handled by the hook via toast
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
