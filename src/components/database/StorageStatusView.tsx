'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Database,
  RefreshCw,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { incrementalSync } from '@/lib/sync/incremental-sync.service';
import type { FullSyncReport, SyncReport, VectorizationReport } from '@/lib/sync/incremental-sync.service';

export function StorageStatusView() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncPhase, setSyncPhase] = useState<'idle' | 'web-to-local' | 'local-to-vector' | 'done'>('idle');
  const [syncProgress, setSyncProgress] = useState(0);
  const [lastReport, setLastReport] = useState<FullSyncReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFullSync = useCallback(async () => {
    setSyncing(true);
    setSyncPhase('web-to-local');
    setSyncProgress(10);
    setError(null);

    try {
      const webToLocal = await incrementalSync.syncWebToLocal();
      setSyncProgress(50);
      setSyncPhase('local-to-vector');

      const localToVector = await incrementalSync.vectorizeLocalToVector();
      setSyncProgress(100);
      setSyncPhase('done');

      const report: FullSyncReport = {
        success: webToLocal.success && localToVector.success,
        webToLocal,
        localToVector,
        totalDuration: webToLocal.duration + localToVector.duration,
      };

      setLastReport(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleIncrementalSync = useCallback(async () => {
    setSyncing(true);
    setSyncPhase('web-to-local');
    setSyncProgress(10);
    setError(null);

    try {
      const report = await incrementalSync.syncWebToLocal();
      setSyncProgress(100);
      setSyncPhase('done');
      setLastReport({ success: report.success, webToLocal: report, localToVector: { success: true, documents: 0, chunks: 0, skipped: 0, errors: [], duration: 0 }, totalDuration: report.duration });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleVectorize = useCallback(async () => {
    setSyncing(true);
    setSyncPhase('local-to-vector');
    setSyncProgress(10);
    setError(null);

    try {
      const report = await incrementalSync.vectorizeLocalToVector();
      setSyncProgress(100);
      setSyncPhase('done');
      setLastReport({ success: report.success, webToLocal: { success: true, pulled: 0, updated: 0, conflicts: 0, errors: [], duration: 0 }, localToVector: report, totalDuration: report.duration });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vectorization failed');
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (syncPhase === 'done') {
      const timer = setTimeout(() => setSyncPhase('idle'), 3000);
      return () => clearTimeout(timer);
    }
  }, [syncPhase]);

  const getSyncStatusLabel = () => {
    if (syncing) {
      if (syncPhase === 'web-to-local') return 'Synchronisation Web → Local...';
      if (syncPhase === 'local-to-vector') return 'Vectorisation...';
    }
    if (lastReport?.success) return ' Synchronisation réussie';
    if (error) return 'Erreur';
    return 'En attente';
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-sm">Synchronisation</h3>
        <div className="flex items-center gap-2">
          {syncing && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
          {!syncing && lastReport?.success && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {error && <XCircle className="h-4 w-4 text-red-500" />}
          <span className="text-xs text-muted-foreground">{getSyncStatusLabel()}</span>
        </div>
      </div>

      {syncing && (
        <div className="mb-4">
          <Progress value={syncProgress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {syncPhase === 'web-to-local' && 'Étape 1/2 : Copie PostgreSQL → SQLite'}
            {syncPhase === 'local-to-vector' && 'Étape 2/2 : Vectorisation SQLite → IndexedDB'}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {error}
        </div>
      )}

      {lastReport && !syncing && (
        <div className="mb-4 p-3 bg-muted/30 rounded-lg text-xs space-y-1">
          <div className="flex justify-between">
            <span>Web → Local :</span>
            <span className={lastReport.webToLocal.success ? 'text-green-600' : 'text-red-600'}>
              {lastReport.webToLocal.pulled} pull, {lastReport.webToLocal.updated} update, {lastReport.webToLocal.errors.length} erreurs
            </span>
          </div>
          <div className="flex justify-between">
            <span>Local → Vector :</span>
            <span className={lastReport.localToVector.success ? 'text-green-600' : 'text-red-600'}>
              {lastReport.localToVector.documents} docs, {lastReport.localToVector.chunks} chunks, {lastReport.localToVector.skipped} ignorés
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Durée totale :</span>
            <span>{(lastReport.totalDuration / 1000).toFixed(1)}s</span>
          </div>
        </div>
      )}

      <Tabs defaultValue="full" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="full">Complète</TabsTrigger>
          <TabsTrigger value="incremental">Incrémentale</TabsTrigger>
          <TabsTrigger value="vectorize">Vectoriser</TabsTrigger>
        </TabsList>

        <TabsContent value="full" className="mt-4">
          <Button size="sm" onClick={handleFullSync} disabled={syncing} className="w-full">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
            Synchronisation complète (Web → Local → Vector)
          </Button>
        </TabsContent>

        <TabsContent value="incremental" className="mt-4">
          <Button size="sm" variant="outline" onClick={handleIncrementalSync} disabled={syncing} className="w-full">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync incrémentale (Web → Local)
          </Button>
        </TabsContent>

        <TabsContent value="vectorize" className="mt-4">
          <Button size="sm" variant="outline" onClick={handleVectorize} disabled={syncing} className="w-full">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
            Vectoriser les données locales
          </Button>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
