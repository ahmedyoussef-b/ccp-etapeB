"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Database,
  HardDrive,
  Cpu,
  RefreshCw,
  RotateCcw,
  ArrowRightLeft,
  Trash2,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { AdminTreeView } from "@/components/database/AdminTreeView";
import type { UnifiedTreeNode, TreeNodeSource } from "@/lib/db/types/unified-tree-node";
import { UnifiedTreeService } from "@/lib/db/services/unified-tree.service";
import { clientEngine } from "@/lib/client-engine";
import { query } from "@/lib/client-engine/sqlite";
import { csrfFetch } from "@/lib/procedures/csrf-fetch";

type DbTab = "postgresql" | "sqlite" | "vector";

const sourceMap: Record<DbTab, TreeNodeSource> = {
  postgresql: "web",
  sqlite: "local",
  vector: "vector",
};

interface DbMetrics {
  postgresql: {
    totalNodes: number;
    folders: number;
    files: number;
    lastSync: string | null;
  };
  sqlite: {
    nodeCount: number;
    compressionEnabled: boolean;
    lastSync: string | null;
  };
  vector: {
    documentCount: number;
    chunkCount: number;
    lastIndexed: number | null;
  };
}

export default function AdminBDDPage() {
  const [metrics, setMetrics] = useState<DbMetrics | null>(null);
  const [trees, setTrees] = useState<Record<DbTab, UnifiedTreeNode[]>>({
    postgresql: [],
    sqlite: [],
    vector: [],
  });
  const [treeErrors, setTreeErrors] = useState<Record<DbTab, string | null>>({
    postgresql: null,
    sqlite: null,
    vector: null,
  });
  const [treeLoading, setTreeLoading] = useState<Record<DbTab, boolean>>({
    postgresql: false,
    sqlite: false,
    vector: false,
  });
  const [activeTab, setActiveTab] = useState<DbTab>("postgresql");
  const [confirmAction, setConfirmAction] = useState<{ source: DbTab; action: string } | null>(null);

  const loadMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/bdd/metrics");
      if (!res.ok) throw new Error("Failed to load metrics");
      const data = await res.json();
      setMetrics((prev) => ({
        postgresql: {
          totalNodes: data.postgresql.totalNodes ?? 0,
          folders: data.postgresql.folders ?? 0,
          files: data.postgresql.files ?? 0,
          lastSync: data.postgresql.lastSync,
        },
        sqlite: prev?.sqlite ?? { nodeCount: 0, compressionEnabled: false, lastSync: null },
        vector: prev?.vector ?? { documentCount: 0, chunkCount: 0, lastIndexed: null },
      }));
    } catch {
      toast.error("Impossible de charger les métriques");
    }
  }, []);

  const loadTree = useCallback(async (source: DbTab) => {
    setTreeLoading((prev) => ({ ...prev, [source]: true }));
    setTreeErrors((prev) => ({ ...prev, [source]: null }));
    try {
      if (source === "postgresql") {
        const res = await fetch("/api/bdd/postgresql/tree");
        if (!res.ok) throw new Error("Failed to load PostgreSQL tree");
        const data = await res.json();
        setTrees((prev) => ({ ...prev, postgresql: data.roots }));
      } else if (source === "sqlite") {
        const tree = await UnifiedTreeService.loadLocalTree();
        setTrees((prev) => ({ ...prev, sqlite: tree }));
      } else if (source === "vector") {
        const tree = await UnifiedTreeService.loadVectorTree();
        setTrees((prev) => ({ ...prev, vector: tree }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setTreeErrors((prev) => ({ ...prev, [source]: msg }));
      toast.error(`Erreur chargement arbre ${source}: ${msg}`);
    } finally {
      setTreeLoading((prev) => ({ ...prev, [source]: false }));
    }
  }, []);

  const loadAllTrees = useCallback(async () => {
    const results = await Promise.allSettled([
      loadTree("postgresql"),
      loadTree("sqlite"),
      loadTree("vector"),
    ]);

    for (let i = 0; i < results.length; i++) {
      const source = ["postgresql", "sqlite", "vector"][i] as DbTab;
      if (results[i].status === "rejected") {
        toast.error(`Erreur chargement arbre ${source}`);
      }
    }
  }, [loadTree]);

  useEffect(() => {
    loadMetrics();
    loadAllTrees();
  }, [loadMetrics, loadAllTrees]);

  useEffect(() => {
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, [loadMetrics]);

  const getSqliteMetrics = useCallback(async () => {
    try {
      const tree = await UnifiedTreeService.loadLocalTree();
      const nodeCount = tree.reduce((acc, node) => acc + 1 + countChildren(node), 0);
      const [metaRes, compRes] = await Promise.all([
        query<{ value: string }>(`SELECT value FROM sync_metadata WHERE key = 'last_pg_to_sqlite_sync' LIMIT 1`),
        fetch("/api/bdd/sqlite/metrics"),
      ]);
      const lastSync = metaRes[0]?.value ?? null;
      const compData = compRes.ok ? await compRes.json() : { compressionEnabled: false };

      setMetrics((prev) => prev ? {
        ...prev,
        sqlite: { nodeCount, compressionEnabled: compData.compressionEnabled ?? false, lastSync },
      } : prev);
    } catch {
      // ignore
    }
  }, []);

  const getVectorMetrics = useCallback(async () => {
    try {
      const { vectorReindexService } = await import(/* webpackIgnore: true */ '@/lib/sync/vector-reindex.service');
      const m = await vectorReindexService.getMetrics();
      setMetrics((prev) => prev ? {
        ...prev,
        vector: {
          documentCount: m.documentCount,
          chunkCount: m.chunkCount,
          lastIndexed: m.lastIndexed,
        },
      } : prev);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    getSqliteMetrics();
    getVectorMetrics();
  }, [getSqliteMetrics, getVectorMetrics]);

  const handleAction = useCallback(async (source: DbTab, action: string) => {
    setConfirmAction({ source, action });
  }, []);

  const confirmActionHandler = useCallback(async () => {
    if (!confirmAction) return;
    const { source, action } = confirmAction;
    setConfirmAction(null);

    try {
      if (source === "postgresql") {
        if (action === "sync") {
          toast.loading("Synchronisation PostgreSQL → SQLite...");
          const res = await csrfFetch("/api/sync/pg-to-sqlite", { method: "POST" });
          if (!res.ok) throw new Error("Sync failed");
          const data = await res.json();
          toast.dismiss();
          toast.success(`Sync OK: ${data.inserted} inserted, ${data.updated} updated`);
          await loadMetrics();
          await loadTree("postgresql");
        }
      } else if (source === "sqlite") {
        if (action === "sync") {
          toast.loading("Synchronisation SQLite...");
          const { syncManager } = await import("@/lib/sync/sync-manager");
          const result = await syncManager.resetAndPullTable("local_tree");
          toast.dismiss();
          if (result.errors.length > 0) {
            toast.error(`Erreurs: ${result.errors.join(", ")}`);
          } else {
            toast.success(`Sync OK: ${result.pulled} pulled`);
          }
          await loadTree("sqlite");
          await getSqliteMetrics();
        } else if (action === "compress") {
          toast.loading("Compression SQLite...");
          const res = await csrfFetch("/api/bdd/sqlite/compress", { method: "POST" });
          if (!res.ok) throw new Error("Compression failed");
          const result = await res.json();
          toast.dismiss();
          toast.success(`Compression OK: ${result.compressed} éléments compressés`);
          await getSqliteMetrics();
        } else if (action === "reset") {
          toast.loading("Réinitialisation SQLite...");
          await clientEngine.resetLocalTreeOnly();
          toast.dismiss();
          toast.success("SQLite réinitialisée");
          setTrees((prev) => ({ ...prev, sqlite: [] }));
          await getSqliteMetrics();
        }
      } else if (source === "vector") {
        if (action === "reindex") {
          toast.loading("Réindexation vectorielle...");
          const { vectorReindexService } = await import(/* webpackIgnore: true */ '@/lib/sync/vector-reindex.service');
          const result = await vectorReindexService.fullReindex();
          toast.dismiss();
          if (result.errors.length > 0) {
            toast.error(`Erreurs: ${result.errors.join(", ")}`);
          } else {
            toast.success(`Réindexation OK: ${result.documentCount} docs, ${result.chunkCount} chunks`);
          }
          await loadTree("vector");
          await getVectorMetrics();
        } else if (action === "clear") {
          toast.loading("Vidage IndexedDB...");
          await clientEngine.clearAllVectorDocuments();
          toast.dismiss();
          toast.success("IndexedDB vidée");
          setTrees((prev) => ({ ...prev, vector: [] }));
          await getVectorMetrics();
        }
      }
    } catch (err) {
      toast.dismiss();
      const msg = err instanceof Error ? err.message : "Action failed";
      toast.error(`Erreur: ${msg}`);
    }
  }, [confirmAction, loadMetrics, loadTree, getSqliteMetrics, getVectorMetrics]);

  const postgresqlActions = useMemo(() => [
    { label: "Synchroniser", action: "sync", icon: RefreshCw, variant: "default" as const },
  ], []);

  const sqliteActions = useMemo(() => [
    { label: "Sync manuel", action: "sync", icon: ArrowRightLeft, variant: "default" as const },
    { label: "Compresser", action: "compress", icon: Activity, variant: "secondary" as const },
    { label: "Reset", action: "reset", icon: RotateCcw, variant: "destructive" as const },
  ], []);

  const vectorActions = useMemo(() => [
    { label: "Réindexer", action: "reindex", icon: Cpu, variant: "default" as const },
    { label: "Vider", action: "clear", icon: Trash2, variant: "destructive" as const },
  ], []);

  const metricCards = useMemo(() => {
    if (!metrics) return [];
    return [
      {
        source: "postgresql" as DbTab,
        title: "PostgreSQL",
        icon: Database,
        color: "text-blue-500",
        items: [
          { label: "Nœuds", value: metrics.postgresql.totalNodes },
          { label: "Dossiers", value: metrics.postgresql.folders },
          { label: "Fichiers", value: metrics.postgresql.files },
          { label: "Dernière sync", value: metrics.postgresql.lastSync ? new Date(metrics.postgresql.lastSync).toLocaleString("fr-FR") : "Jamais" },
        ],
      },
      {
        source: "sqlite" as DbTab,
        title: "SQLite (WASM)",
        icon: HardDrive,
        color: "text-green-500",
        items: [
          { label: "Nœuds", value: metrics.sqlite.nodeCount },
          { label: "Compression", value: metrics.sqlite.compressionEnabled ? "Activée" : "Désactivée" },
          { label: "Dernière sync", value: metrics.sqlite.lastSync ? new Date(metrics.sqlite.lastSync).toLocaleString("fr-FR") : "Jamais" },
        ],
      },
      {
        source: "vector" as DbTab,
        title: "IndexedDB (Vectorielle)",
        icon: Cpu,
        color: "text-purple-500",
        items: [
          { label: "Documents", value: metrics.vector.documentCount },
          { label: "Chunks", value: metrics.vector.chunkCount },
          { label: "Dernière indexation", value: metrics.vector.lastIndexed ? new Date(metrics.vector.lastIndexed).toLocaleString("fr-FR") : "Jamais" },
        ],
      },
    ];
  }, [metrics]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Administration des 3 BDD</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Supervision et actions sur PostgreSQL, SQLite (WASM) et IndexedDB (Vectorielle).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.source} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`h-5 w-5 ${card.color}`} />
                <h3 className="font-semibold text-sm">{card.title}</h3>
              </div>
              <div className="space-y-1">
                {card.items.map((item) => (
                  <div key={item.label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium">{String(item.value)}</span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DbTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="postgresql" className="flex items-center gap-2">
            <Database className="h-4 w-4" /> PostgreSQL
          </TabsTrigger>
          <TabsTrigger value="sqlite" className="flex items-center gap-2">
            <HardDrive className="h-4 w-4" /> SQLite
          </TabsTrigger>
          <TabsTrigger value="vector" className="flex items-center gap-2">
            <Cpu className="h-4 w-4" /> IndexedDB
          </TabsTrigger>
        </TabsList>

        <TabsContent value="postgresql" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            {postgresqlActions.map((btn) => (
              <Button
                key={btn.action}
                variant={btn.variant}
                size="sm"
                onClick={() => handleAction("postgresql", btn.action)}
              >
                <btn.icon className="h-4 w-4 mr-2" />
                {btn.label}
              </Button>
            ))}
          </div>
          <AdminTreeView
            data={trees.postgresql}
            source={sourceMap.postgresql}
            loading={treeLoading.postgresql}
            error={treeErrors.postgresql}
            onRefresh={() => loadTree("postgresql")}
          />
        </TabsContent>

        <TabsContent value="sqlite" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            {sqliteActions.map((btn) => (
              <Button
                key={btn.action}
                variant={btn.variant}
                size="sm"
                onClick={() => handleAction("sqlite", btn.action)}
              >
                <btn.icon className="h-4 w-4 mr-2" />
                {btn.label}
              </Button>
            ))}
          </div>
          <AdminTreeView
            data={trees.sqlite}
            source={sourceMap.sqlite}
            loading={treeLoading.sqlite}
            error={treeErrors.sqlite}
            onRefresh={() => loadTree("sqlite")}
          />
        </TabsContent>

        <TabsContent value="vector" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            {vectorActions.map((btn) => (
              <Button
                key={btn.action}
                variant={btn.variant}
                size="sm"
                onClick={() => handleAction("vector", btn.action)}
              >
                <btn.icon className="h-4 w-4 mr-2" />
                {btn.label}
              </Button>
            ))}
          </div>
          <AdminTreeView
            data={trees.vector}
            source={sourceMap.vector}
            loading={treeLoading.vector}
            error={treeErrors.vector}
            onRefresh={() => loadTree("vector")}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l&apos;action</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmAction?.action === "reset" || confirmAction?.action === "clear"
              ? "Cette action est irréversible. Toutes les données concernées seront supprimées."
              : "Êtes-vous sûr de vouloir effectuer cette action ?"}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Annuler</Button>
            <Button
              variant={confirmAction?.action === "reset" || confirmAction?.action === "clear" ? "destructive" : "default"}
              onClick={confirmActionHandler}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function countChildren(node: UnifiedTreeNode): number {
  let count = node.children.length;
  for (const child of node.children) {
    count += countChildren(child);
  }
  return count;
}
