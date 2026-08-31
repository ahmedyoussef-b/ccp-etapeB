'use client';

import { Card } from '@/components/ui/card';

export function StorageStatusView() {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Synchronisation</h3>
        <span className="text-xs text-muted-foreground">Miroir automatique activé</span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        L&apos;arborescence locale est miroitée automatiquement au chargement de la page.
      </p>
    </Card>
  );
}
