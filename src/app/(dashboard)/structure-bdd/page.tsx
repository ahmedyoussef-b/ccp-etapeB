"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Database,
  ChevronRight,
  ChevronDown,
  FolderTree,
  FileText,
  FileJson,
  Eye,
  RefreshCw,
  RotateCcw,
  ArrowRightLeft,
  Trash2,
  Plus,
  Pencil,
  Download,
  type LucideIcon,
} from "lucide-react";

import { useSyncData } from "@/lib/sync/useSyncData";
import { getLocalTree, deleteLocalTreeNode, addFolder, updateFolder, addFile } from "@/lib/db/tree";
import { clientEngine } from "@/lib/client-engine";
import { toast } from "sonner";

type LocalNode = {
  id: string;
  name: string;
  type: "folder" | "file" | "meta";
  children: LocalNode[];
  path: string;
};

type WebTreeNode = {
  id: number;
  name: string;
  type: string;
  metadata: string | null;
  parentId: number | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  children: WebTreeNode[];
};

const iconMap: Record<string, LucideIcon> = {
  root: FolderTree,
  category: FolderTree,
  group: FolderTree,
  item: FileText,
  folder: FolderTree,
  file: FileJson,
  meta: FileText,
};

function TreeNodeItem({
  node,
  depth = 0,
  onDelete,
  onAdd,
  onRename,
  onEdit,
  onPreview,
}: {
  node: WebTreeNode | LocalNode;
  depth?: number;
  onDelete?: (node: WebTreeNode | LocalNode) => void;
  onAdd?: (node: WebTreeNode | LocalNode) => void;
  onRename?: (node: WebTreeNode | LocalNode) => void;
  onEdit?: (node: LocalNode) => void;
  onPreview?: (node: WebTreeNode | LocalNode) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const [showActions, setShowActions] = useState(false);
  const isLocal = "path" in node;
  const nodeType = isLocal ? node.type : node.type;
  const Icon = iconMap[nodeType] ?? FileText;

  const getBadgeVariant = () => {
    if (isLocal) {
      if (nodeType === "meta") return "outline";
      if (nodeType === "folder") return "default";
      return "secondary";
    }
    return "secondary";
  };

  const getBadgeText = () => {
    if (isLocal) {
      if (nodeType === "meta") return "meta";
      if (nodeType === "folder") return "dossier";
      return "fichier";
    }
    return node.type;
  };

  const isJsonFile = isLocal && nodeType === "file" && node.name.endsWith(".json");
  const isFileNode = nodeType === "file" || nodeType === "item";

  return (
    <div
      className="group relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {node.children.length > 0 ? (
          expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )
        ) : (
          <span className="w-4" />
        )}
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground flex-1">{node.name}</span>
        <Badge variant={getBadgeVariant()} className="text-xs">
          {getBadgeText()}
        </Badge>

        {showActions && (
          <div className="flex items-center gap-1 ml-2">
            {(nodeType === "directory" || nodeType === "folder" || nodeType === "root") && onAdd && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd(node);
                }}
                title="Ajouter"
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onRename?.(node);
              }}
              title="Renommer"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-red-500"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(node);
              }}
              title="Supprimer"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            {isJsonFile && onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(node as LocalNode);
                }}
                title="Éditer"
              >
                <FileJson className="h-3 w-3" />
              </Button>
            )}
            {isFileNode && onPreview && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(node);
                }}
                title="Aperçu"
              >
                <Eye className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {expanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onDelete={onDelete}
              onAdd={onAdd}
              onRename={onRename}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function StructureBDDPage() {
  const [webTree, setWebTree] = useState<WebTreeNode[]>([]);
  const [localTree, setLocalTree] = useState<LocalNode[]>([]);
  const [vectorDocs, setVectorDocs] = useState<{ id: string; name: string; chunks: { content: string }[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [webError, setWebError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [vectorError, setVectorError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [resettingWeb, setResettingWeb] = useState(false);
  const [resettingLocal, setResettingLocal] = useState(false);
  const [clearingData, setClearingData] = useState(false);
  const [syncingAndResetting, setSyncingAndResetting] = useState(false);
  const [addingNode, setAddingNode] = useState<{ tree: "web" | "local"; parentId: number | string } | null>(null);
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeType, setNewNodeType] = useState<"file" | "directory">("directory");
  const [renamingNode, setRenamingNode] = useState<{ tree: "web" | "local"; id: number | string; currentName: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingFile, setEditingFile] = useState<{ tree: "web" | "local"; path: string; content: string } | null>(null);
  const [editContent, setEditContent] = useState("");
  const [previewingFile, setPreviewingFile] = useState<{ path?: string; name: string; tree: "web" | "local" } | null>(null);
  const [previewData, setPreviewData] = useState<{ content?: string; dataUrl?: string; mimeType: string; name: string; size: number; isText: boolean } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const { sync, isSyncing } = useSyncData();
  const [activeView, setActiveView] = useState<"web" | "local" | "vector">("web");

  const loadTrees = async () => {
    console.log("[StructureBDD] loadTrees start");
    setLoading(true);
    setWebError(null);
    setLocalError(null);
    setVectorError(null);

    const webPromise = fetch("/api/tree")
      .then((res) => {
        console.log("[StructureBDD] /api/tree status", res.status);
        if (!res.ok) throw new Error("Failed to fetch web tree");
        return res.json();
      })
      .then((data) => {
        const roots = (data as { roots: WebTreeNode[] }).roots;
        console.log("[StructureBDD] web tree loaded", { count: roots.length });
        setWebTree(roots);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[StructureBDD] web tree error", msg);
        setWebError(msg);
        setWebTree([]);
      });

    const localPromise = getLocalTree()
      .then((tree) => {
        console.log("[StructureBDD] local tree loaded", { count: tree.length });
        setLocalTree(tree);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[StructureBDD] local tree error", msg);
        setLocalError(msg);
        setLocalTree([]);
      });

    const vectorPromise = clientEngine.init()
      .then(() => clientEngine.getAllVectorDocuments())
      .then((docs) => {
        console.log("[StructureBDD] vector docs loaded", { count: docs.length });
        setVectorDocs(docs.map((d) => ({ id: d.id, name: d.name, chunks: d.chunks })));
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[StructureBDD] vector docs error", msg);
        setVectorError(msg);
        setVectorDocs([]);
      });

    await Promise.all([webPromise, localPromise, vectorPromise]);
    console.log("[StructureBDD] loadTrees done", {
      web: webTree.length,
      local: localTree.length,
      vector: vectorDocs.length,
    });
    setLoading(false);
  };

  useEffect(() => {
    console.log("[StructureBDD] mount");
    loadTrees();
  }, []);

  const handleSync = async () => {
    console.log("[StructureBDD] sync start");
    await sync();
    await loadTrees();
    console.log("[StructureBDD] sync done");
  };

  const handleResetWeb = async () => {
    const confirmed = window.confirm(
      "Remise à zéro de la BDD Web : toutes les données web seront réinitialisées à l'état initial. Continuer ?"
    );
    if (!confirmed) return;
    console.log("[StructureBDD] reset web start");

    setResettingWeb(true);
    try {
      const res = await fetch("/api/tree/reset", { method: "POST" });
      console.log("[StructureBDD] reset web status", res.status);
      if (!res.ok) throw new Error("Failed to reset web tree");
      await loadTrees();
      toast.success("BDD Web remise à zéro avec succès");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      console.error("[StructureBDD] reset web error", msg);
      setWebError(msg);
      toast.error("Erreur lors de la remise à zéro de la BDD Web");
    } finally {
      setResettingWeb(false);
    }
  };

  const handleResetLocal = async () => {
    const confirmed = window.confirm(
      "Remise à zéro de la BDD Locale : l'arborescence locale sera réinitialisée à l'état initial. Continuer ?"
    );
    if (!confirmed) return;
    console.log("[StructureBDD] reset local start");

    setResettingLocal(true);
    try {
      await clientEngine.init();
      await clientEngine.clearAllData();
      console.log("[StructureBDD] reset local done");
      await loadTrees();
      toast.success("BDD Locale remise à zéro avec succès");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      console.error("[StructureBDD] reset local error", msg);
      setLocalError(msg);
      toast.error("Erreur lors de la remise à zéro de la BDD Locale");
    } finally {
      setResettingLocal(false);
    }
  };

  const handleClearData = async () => {
    const confirmed = window.confirm(
      "Supprimer le contenu de .data ? Cette action est irréversible."
    );
    if (!confirmed) return;
    console.log("[StructureBDD] clear data start");

    setClearingData(true);
    try {
      await clientEngine.init();
      await clientEngine.clearAllData();
      console.log("[StructureBDD] clear data done");
      await loadTrees();
      toast.success("Contenu de .data supprimé");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Clear failed";
      console.error("[StructureBDD] clear data error", msg);
      setLocalError(msg);
      toast.error("Erreur lors de la suppression de .data");
    } finally {
      setClearingData(false);
    }
  };

  const handleSyncAndReset = async () => {
    const confirmed = window.confirm(
      "Synchroniser la BDD Web vers la BDD Locale puis remettre à zéro la BDD Web ?"
    );
    if (!confirmed) return;
    console.log("[StructureBDD] sync and reset start");

    setSyncingAndResetting(true);
    try {
      const syncRes = await fetch("/api/tree/sync-to-local", { method: "POST" });
      console.log("[StructureBDD] sync-to-local status", syncRes.status);
      if (!syncRes.ok) throw new Error("Failed to sync web tree to local");

      const resetRes = await fetch("/api/tree/reset", { method: "POST" });
      console.log("[StructureBDD] reset web status", resetRes.status);
      if (!resetRes.ok) throw new Error("Failed to reset web tree");

      await loadTrees();
      toast.success("Synchronisation terminée et BDD Web remise à zéro");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync and reset failed";
      console.error("[StructureBDD] sync and reset error", msg);
      setWebError(msg);
      toast.error("Erreur lors de la synchronisation");
    } finally {
      setSyncingAndResetting(false);
    }
  };

  const handleDeleteWeb = async (node: WebTreeNode | LocalNode) => {
    const confirmed = window.confirm(`Supprimer "${node.name}" ?`);
    if (!confirmed) return;
    console.log("[StructureBDD] delete web", { id: node.id, name: node.name });

    try {
      const res = await fetch(`/api/tree/nodes/${node.id}`, { method: "DELETE" });
      console.log("[StructureBDD] delete web status", res.status);
      if (!res.ok) throw new Error("Failed to delete node");
      await loadTrees();
      toast.success("Nœud supprimé");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      console.error("[StructureBDD] delete web error", msg);
      setWebError(msg);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleDeleteLocal = async (node: WebTreeNode | LocalNode) => {
    if (!("id" in node)) return;
    const confirmed = window.confirm(`Supprimer "${node.name}" ?`);
    if (!confirmed) return;
    console.log("[StructureBDD] delete local", { id: node.id, name: node.name });

    try {
      const idStr = node.id as string;
      const numericId = parseInt(idStr.replace(/^(folder|file)-/, ""), 10);
      if (!isNaN(numericId)) {
        await deleteLocalTreeNode(numericId);
        console.log("[StructureBDD] delete local done", { numericId });
        await loadTrees();
        toast.success("Nœud supprimé");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      console.error("[StructureBDD] delete local error", msg);
      setLocalError(msg);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleAddWeb = async (node: WebTreeNode | LocalNode) => {
    if (!("id" in node) || typeof node.id === "string") return;
    setAddingNode({ tree: "web", parentId: node.id });
    setNewNodeName("");
    setNewNodeType("directory");
  };

  const handleAddLocal = async (node: WebTreeNode | LocalNode) => {
    if (!("id" in node)) return;
    setAddingNode({ tree: "local", parentId: node.id as string });
    setNewNodeName("");
    setNewNodeType("directory");
  };

  const confirmAdd = async () => {
    if (!addingNode || !newNodeName.trim()) return;

    try {
      if (addingNode.tree === "web") {
        const res = await fetch(`/api/tree/nodes/${addingNode.parentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newNodeName, type: newNodeType }),
        });
        if (!res.ok) throw new Error("Failed to add node");
      } else {
        const parentIdStr = addingNode.parentId as string;
        const parentId = parseInt(parentIdStr.replace(/^(folder|file)-/, ""), 10);
        if (isNaN(parentId)) {
          throw new Error("Invalid parent ID");
        }
        if (newNodeType === "directory") {
          await addFolder({
            remoteId: `local-${Date.now()}`,
            name: newNodeName,
            parentId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } else {
          await addFile({
            remoteId: `local-${Date.now()}`,
            name: newNodeName,
            folderId: parentId,
            size: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      setAddingNode(null);
      setNewNodeName("");
      await loadTrees();
      toast.success("Nœud ajouté");
    } catch (err) {
      if (addingNode.tree === "web") {
        setWebError(err instanceof Error ? err.message : "Add failed");
      } else {
        setLocalError(err instanceof Error ? err.message : "Add failed");
      }
      toast.error("Erreur lors de l'ajout");
    }
  };

  const handleRenameWeb = async (node: WebTreeNode | LocalNode) => {
    setRenamingNode({ tree: "web", id: node.id, currentName: node.name });
    setRenameValue(node.name);
  };

  const handleRenameLocal = async (node: WebTreeNode | LocalNode) => {
    if (!("id" in node)) return;
    setRenamingNode({ tree: "local", id: node.id as string, currentName: node.name });
    setRenameValue(node.name);
  };

  const confirmRename = async () => {
    if (!renamingNode || !renameValue.trim()) return;

    try {
      if (renamingNode.tree === "web") {
        const res = await fetch(`/api/tree/nodes/${renamingNode.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: renameValue }),
        });
        if (!res.ok) throw new Error("Failed to rename node");
      } else {
        const idStr = renamingNode.id as string;
        const numericId = parseInt(idStr.replace(/^(folder|file)-/, ""), 10);
        if (!isNaN(numericId) && idStr.startsWith("folder-")) {
          await updateFolder(numericId, { name: renameValue });
        }
      }

      setRenamingNode(null);
      setRenameValue("");
      await loadTrees();
      toast.success("Nœud renommé");
    } catch (err) {
      if (renamingNode.tree === "web") {
        setWebError(err instanceof Error ? err.message : "Rename failed");
      } else {
        setLocalError(err instanceof Error ? err.message : "Rename failed");
      }
      toast.error("Erreur lors du renommage");
    }
  };

  const handleEditJson = (node: LocalNode) => {
    if (!node.id) return;
    setEditingFile({ tree: "local", path: node.id as string, content: "" });
    setEditContent("");
  };

  const confirmEditJson = async () => {
    if (!editingFile) return;

    try {
      if (editingFile.tree === "local") {
        toast.message("Édition locale désactivée", { description: "L'édition de fichiers locaux n'est plus disponible via l'API." });
        setEditingFile(null);
        setEditContent("");
        return;
      }
      const res = await fetch(`/api/tree/nodes/${editingFile.path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: editContent }),
      });
      if (!res.ok) throw new Error("Failed to edit file");

      setEditingFile(null);
      setEditContent("");
      await loadTrees();
      toast.success("Fichier JSON modifié");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Edit failed");
      toast.error("Erreur lors de la modification du fichier");
    }
  };

  const filterWebTree = (nodes: WebTreeNode[]): WebTreeNode[] => {
    if (!search.trim()) return nodes;
    const term = search.toLowerCase();
    const matches = (node: WebTreeNode): boolean => {
      const nameMatch = node.name.toLowerCase().includes(term);
      const typeMatch = node.type.toLowerCase().includes(term);
      const childMatch = node.children.some(matches);
      return nameMatch || typeMatch || childMatch;
    };
    const prune = (nodes: WebTreeNode[]): WebTreeNode[] => {
      return nodes
        .filter(matches)
        .map((node) => ({
          ...node,
          children: prune(node.children),
        }));
    };
    return prune(nodes);
  };

  const filterLocalTree = (nodes: LocalNode[]): LocalNode[] => {
    if (!search.trim()) return nodes;
    const term = search.toLowerCase();
    const matches = (node: LocalNode): boolean => {
      const nameMatch = node.name.toLowerCase().includes(term);
      const typeMatch = node.type.toLowerCase().includes(term);
      const childMatch = node.children.some(matches);
      return nameMatch || typeMatch || childMatch;
    };
    const prune = (nodes: LocalNode[]): LocalNode[] => {
      return nodes
        .filter(matches)
        .map((node) => ({
          ...node,
          children: prune(node.children),
        }));
    };
    return prune(nodes);
  };

  const handlePreviewFile = async (node: WebTreeNode | LocalNode) => {
    const isLocal = "path" in node;

    // BDD Web: read metadata directly from the node (no local file needed)
    if (!isLocal) {
      const webNode = node as WebTreeNode;
      setPreviewingFile({ name: webNode.name, tree: "web" });
      setPreviewData(null);
      setPreviewLoading(true);
      try {
        const raw = webNode.metadata || "{}";
        const content = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
        // Pretty-print if JSON
        let pretty = content;
        try { pretty = JSON.stringify(JSON.parse(content), null, 2); } catch { /* not json */ }
        setPreviewData({
          content: pretty,
          mimeType: "application/json",
          name: webNode.name,
          size: new TextEncoder().encode(pretty).length,
          isText: true,
        });
      } catch {
        toast.error("Erreur lors de la lecture des métadonnées");
        setPreviewingFile(null);
      } finally {
        setPreviewLoading(false);
      }
      return;
    }

    // BDD Locale: preview disabled (no server API)
    toast.message("Aperçu local désactivé", { description: "L'aperçu de fichiers locaux n'est plus disponible via l'API." });
    setPreviewingFile(null);
    setPreviewData(null);
    setPreviewLoading(false);
    return;
  };

  const visibleWebTree = filterWebTree(webTree);
  const visibleLocalTree = filterLocalTree(localTree);
  const totalNodes = (nodes: (WebTreeNode | LocalNode)[]): number =>
    nodes.reduce((acc, node) => acc + 1 + totalNodes(node.children), 0);

  if (loading) {
    console.log("[StructureBDD] render loading");
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">Chargement de la structure...</p>
      </section>
    );
  }

  console.log("[StructureBDD] render result", {
    web: visibleWebTree.length,
    local: visibleLocalTree.length,
    vector: vectorDocs.length,
    webError: !!webError,
    localError: !!localError,
    vectorError: !!vectorError,
  });

  const activeTree = activeView === "web" ? visibleWebTree : activeView === "local" ? visibleLocalTree : [];
  const activeError = activeView === "web" ? webError : activeView === "local" ? localError : vectorError;
  const totalActiveNodes = totalNodes(activeTree);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Structure BDD</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Vue active : {activeView === "web" ? "Hub / PostgreSQL" : activeView === "local" ? "Spoke / SQLite OPFS" : "Spoke / IndexedDB"} · {totalActiveNodes} nœuds
            {activeError && <span className="text-red-500"> · Erreur: {activeError}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={activeView === "web" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("web")}
          >
            Hub / Web
          </Button>
          <Button
            variant={activeView === "local" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("local")}
          >
            SQLite
          </Button>
          <Button
            variant={activeView === "vector" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("vector")}
          >
            Vectorielle
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="border-b border-border px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Arborescence</h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {totalActiveNodes} nœuds
              </Badge>
              {activeView === "web" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleResetWeb}
                  disabled={resettingWeb}
                  title="Remettre à zéro"
                >
                  <RotateCcw className={`h-4 w-4 ${resettingWeb ? "animate-spin" : ""}`} />
                </Button>
              )}
              {activeView === "local" && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleResetLocal}
                    disabled={resettingLocal}
                    title="Remettre à zéro"
                  >
                    <RotateCcw className={`h-4 w-4 ${resettingLocal ? "animate-spin" : ""}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClearData}
                    disabled={clearingData}
                    title="Supprimer (.data)"
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className={`h-4 w-4 ${clearingData ? "animate-spin" : ""}`} />
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="p-2 max-h-[600px] overflow-y-auto">
            {activeError ? (
              <p className="text-sm text-red-500 text-center py-8">
                Erreur : {activeError}
              </p>
            ) : activeTree.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune donnée.
              </p>
            ) : (
              activeTree.map((node) => (
                <TreeNodeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  onDelete={activeView === "web" ? handleDeleteWeb : activeView === "local" ? handleDeleteLocal : undefined}
                  onAdd={activeView === "web" ? handleAddWeb : activeView === "local" ? handleAddLocal : undefined}
                  onRename={activeView === "web" ? handleRenameWeb : activeView === "local" ? handleRenameLocal : undefined}
                  onEdit={activeView === "local" ? handleEditJson : undefined}
                  onPreview={handlePreviewFile}
                />
              ))
            )}
          </div>
          <div className="p-3 border-t border-border flex flex-col gap-2">
            {activeView === "web" && (
              <Button
                variant="default"
                size="sm"
                onClick={handleSyncAndReset}
                disabled={syncingAndResetting}
                className="w-full"
              >
                <ArrowRightLeft className={`h-4 w-4 mr-2 ${syncingAndResetting ? "animate-spin" : ""}`} />
                Sync Web → Local
              </Button>
            )}
            {activeView === "local" && (
              <Button
                variant="default"
                size="sm"
                onClick={handleSync}
                disabled={isSyncing}
                className="w-full"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                Synchroniser
              </Button>
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-border px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Visualiseur</h3>
            </div>
            {previewingFile && (
              <Badge variant="outline" className="text-xs">
                {previewingFile.name}
              </Badge>
            )}
          </div>
          <div className="p-4 max-h-[600px] overflow-y-auto">
            {!previewingFile ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sélectionnez un nœud dans l'arborescence pour afficher son contenu.
              </p>
            ) : previewLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Chargement...</p>
            ) : previewData ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{previewData.mimeType}</span>
                  <span className="text-xs text-muted-foreground">{(previewData.size / 1024).toFixed(1)} Ko</span>
                </div>
                {previewData.isText && previewData.content !== undefined ? (
                  <pre className="text-xs font-mono text-foreground overflow-auto max-h-[520px] whitespace-pre-wrap break-all bg-muted/30 p-3 rounded-md">
                    {previewData.content}
                  </pre>
                ) : previewData.dataUrl ? (
                  previewData.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewData.dataUrl} alt={previewData.name} className="max-h-[520px] w-full object-contain rounded-md" />
                  ) : previewData.mimeType.startsWith("video/") ? (
                    <video src={previewData.dataUrl} controls className="max-h-[520px] w-full rounded-md" />
                  ) : (
                    <p className="text-sm text-muted-foreground">Aperçu non disponible pour ce type de fichier.</p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">Aperçu non disponible.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun contenu.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Add Node Modal */}
      <Dialog open={!!addingNode} onOpenChange={(open) => !open && setAddingNode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un nœud</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nom</label>
              <Input
                value={newNodeName}
                onChange={(e) => setNewNodeName(e.target.value)}
                placeholder="Nom du nœud"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <Select value={newNodeType} onValueChange={(value) => setNewNodeType(value as "file" | "directory")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="directory">Dossier</SelectItem>
                  <SelectItem value="file">Fichier</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingNode(null)}>
              Annuler
            </Button>
            <Button onClick={confirmAdd}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Modal */}
      <Dialog open={!!renamingNode} onOpenChange={(open) => !open && setRenamingNode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Nouveau nom</label>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Nouveau nom"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingNode(null)}>
              Annuler
            </Button>
            <Button onClick={confirmRename}>Renommer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit JSON Modal */}
      <Dialog open={!!editingFile} onOpenChange={(open) => !open && setEditingFile(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Éditer le fichier JSON</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Contenu</label>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder='{ "key": "value" }'
              className="w-full h-96 p-2 font-mono text-sm border rounded-md"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFile(null)}>
              Annuler
            </Button>
            <Button onClick={confirmEditJson}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={!!previewingFile} onOpenChange={(open) => !open && setPreviewingFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Aperçu : {previewingFile?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {previewLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : previewData ? (
              <>
                <div className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-2">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {previewData.mimeType || "application/octet-stream"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {(previewData.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (previewData.content) {
                          const blob = new Blob([previewData.content], { type: previewData.mimeType || "text/plain" });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement("a");
                          link.href = url;
                          link.download = previewingFile?.name || "file";
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                         } else {
                           const link = document.createElement("a");
                           link.href = previewData.dataUrl || "#";
                           link.download = previewingFile?.name || "file";
                           document.body.appendChild(link);
                           link.click();
                           document.body.removeChild(link);
                         }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger
                    </Button>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/10 overflow-hidden">
                  {previewData.isText && previewData.content !== undefined ? (
                    <pre className="p-4 text-sm font-mono text-foreground overflow-auto max-h-[60vh] whitespace-pre-wrap break-all">
                      {previewData.content}
                    </pre>
                     ) : previewData.dataUrl ? (
                     previewData.mimeType.startsWith("image/") ? (
                       // eslint-disable-next-line @next/next/no-img-element
                       <img
                         src={previewData.dataUrl}
                         alt={previewData.name}
                         className="max-h-[60vh] w-full object-contain"
                       />
                    ) : previewData.mimeType.startsWith("video/") ? (
                      <video
                        src={previewData.dataUrl}
                        controls
                        className="max-h-[60vh] w-full"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <FileText className="h-12 w-12 mb-2" />
                        <p className="text-sm">Aperçu non disponible pour ce type de fichier</p>
                         <Button
                           variant="outline"
                           size="sm"
                           className="mt-4"
                            onClick={() => {
                              const link = document.createElement("a");
                              link.href = previewData.dataUrl || "#";
                              link.download = previewingFile?.name || "file";
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                         >
                           <Download className="h-4 w-4 mr-2" />
                           Télécharger
                         </Button>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mb-2" />
                      <p className="text-sm">Aperçu non disponible pour ce type de fichier</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = "#";
                            link.download = previewingFile?.name || "file";
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                        >
                        <Download className="h-4 w-4 mr-2" />
                        Télécharger
                      </Button>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewingFile(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
